import { describe, expect, it } from "vitest";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { DrizzleTransactionRepository } from "../../src/adapters/db/drizzle-transaction-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { transactions as transactionRows } from "../../src/adapters/db/schema.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { createCategorizationRule } from "../../src/core/categorization/categorization-rule.js";
import { reapplyCategorizationRules } from "../../src/core/categorization/reapply-categorization-rules.js";
import { expectTransactionFilterContract } from "../support/transaction-repository-contract.js";
import { aTransaction } from "../support/transactions.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle transaction repository", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-CAT-005-02 INT-FF-TXN-001-01 INT-FF-TXN-001-03 INT-FF-TXN-001-04 INT-FF-TXN-003-01 INT-FF-TXN-004-01 INT-FF-TXN-005-01 INT-FF-TXN-005-03: reapplies through PostgreSQL and round-trips origin without overwriting concurrent edits",
    async () => {
      if (testDatabaseUrl === undefined) {
        throw new Error("TEST_DATABASE_URL is required");
      }

      await migrate(testDatabaseUrl);

      const connection = createPostgresConnection(testDatabaseUrl);
      const transactions = new DrizzleTransactionRepository(connection.db);

      try {
        await seedMasterData(
          {
            accounts: new DrizzleAccountRepository(connection.db),
            categories: new DrizzleCategoryRepository(connection.db),
            ownerContexts: new DrizzleOwnerContextRepository(connection.db),
          },
          createGermanLocalization(),
        );

        await connection.db.insert(transactionRows).values({
          id: "transaction-drizzle-default-transfer",
          accountId: "account-person-a-checking",
          categoryId: "category-groceries",
          categoryOrigin: "manual",
          date: "2026-07-15",
          amountCents: -100,
          description: "Database default transfer state",
          source: "manual",
          status: "booked",
          fixedCost: false,
        });
        const defaultTransfer = await transactions.get("transaction-drizzle-default-transfer");
        expect(defaultTransfer).toMatchObject({ internalTransfer: false });

        const rent = aTransaction({
          id: "transaction-drizzle-rent",
          accountId: "account-shared-checking",
          categoryId: "category-housing-rent",
          categoryOrigin: "rule",
          date: "2026-07-01",
          amountCents: -120000,
          description: "Drizzle rent",
          payee: "Landlord",
          purpose: "Imported purpose",
          importHash: "v2:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          status: "planned",
          fixedCost: true,
        });

        await transactions.save(rent);
        await expect(transactions.get(rent.id)).resolves.toMatchObject({
          categoryOrigin: "rule",
        });

        const markedRent = { ...rent, internalTransfer: true };
        await transactions.save(markedRent);
        await expect(transactions.get(rent.id)).resolves.toMatchObject({ internalTransfer: true });
        await expect(
          transactions.list({ internalTransfer: true } as Parameters<typeof transactions.list>[0]),
        ).resolves.toEqual([markedRent]);
        await expect(
          transactions.list({ internalTransfer: false } as Parameters<typeof transactions.list>[0]),
        ).resolves.toEqual([defaultTransfer]);

        await expect(
          transactions.list({ month: "2026-07", ownerContext: "shared" }),
        ).resolves.toEqual([markedRent]);

        const staleSnapshot = await transactions.get(rent.id);
        if (staleSnapshot === null) throw new Error("Concurrency fixture must exist");
        await transactions.save({
          ...staleSnapshot,
          status: "booked",
          description: "Concurrent booked rent",
          note: "Concurrent edit must survive",
        });
        const atomicRepository = transactions as unknown as {
          setInternalTransfer(id: string, internalTransfer: boolean): Promise<boolean>;
        };
        await expect(atomicRepository.setInternalTransfer(rent.id, false)).resolves.toBe(true);
        await expect(transactions.get(rent.id)).resolves.toMatchObject({
          description: "Concurrent booked rent",
          purpose: "Imported purpose",
          importHash: "v2:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          note: "Concurrent edit must survive",
          status: "booked",
          internalTransfer: false,
        });
        await expect(
          atomicRepository.setInternalTransfer("missing-transaction", true),
        ).resolves.toBe(false);

        await transactions.delete(rent.id);
        await expect(transactions.get(rent.id)).resolves.toBeNull();
        await transactions.delete("transaction-drizzle-default-transfer");

        const reapplicationFixtures = [
          aTransaction({
            id: "transaction-reapply-a",
            description: "Reapply market planned",
            categoryId: "category-other",
            categoryOrigin: "fallback",
            status: "planned",
          }),
          aTransaction({
            id: "transaction-reapply-z",
            description: "Reapply market booked",
            categoryId: "category-other",
            categoryOrigin: "fallback",
          }),
        ];
        for (const fixture of reapplicationFixtures) await transactions.save(fixture);
        await expect(
          reapplyCategorizationRules(
            [
              createCategorizationRule({
                id: "rule-reapply-market",
                name: "Reapply market",
                searchText: "reapply market",
                categoryId: "category-groceries",
                priority: 1,
                enabled: true,
              }),
            ],
            transactions,
          ),
        ).resolves.toEqual({ changed: 2, unchanged: 0 });
        await expect(transactions.get("transaction-reapply-a")).resolves.toMatchObject({
          categoryId: "category-groceries",
          categoryOrigin: "rule",
          status: "planned",
        });
        await transactions.delete("transaction-reapply-a");
        await transactions.delete("transaction-reapply-z");

        await expectTransactionFilterContract(transactions);

        const minimumIntegerCents = aTransaction({
          id: "transaction-drizzle-minimum-integer-cents",
          amountCents: -2147483648,
        });
        await transactions.save(minimumIntegerCents);
        await expect(transactions.get(minimumIntegerCents.id)).resolves.toEqual(
          minimumIntegerCents,
        );
        await transactions.delete(minimumIntegerCents.id);
      } finally {
        await transactions.delete("transaction-drizzle-default-transfer");
        await transactions.delete("transaction-drizzle-rent");
        await transactions.delete("transaction-reapply-a");
        await transactions.delete("transaction-reapply-z");
        await transactions.delete("transaction-filter-groceries");
        await transactions.delete("transaction-filter-rent");
        await transactions.delete("transaction-drizzle-minimum-integer-cents");
        await connection.client.end();
      }
    },
  );
});
