import { describe, expect, it } from "vitest";

import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { DrizzleTransactionRepository } from "../../src/adapters/db/drizzle-transaction-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { transactions as transactionRows } from "../../src/adapters/db/schema.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { expectTransactionFilterContract } from "../support/transaction-repository-contract.js";
import { aTransaction } from "../support/transactions.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle transaction repository", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-TXN-001-01 INT-FF-TXN-001-03 INT-FF-TXN-004-01 INT-FF-TXN-005-01 INT-FF-TXN-005-03: persists transfer state atomically without overwriting concurrent edits",
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

        await expectTransactionFilterContract(transactions);
      } finally {
        await transactions.delete("transaction-drizzle-default-transfer");
        await transactions.delete("transaction-drizzle-rent");
        await transactions.delete("transaction-filter-groceries");
        await transactions.delete("transaction-filter-rent");
        await connection.client.end();
      }
    },
  );
});
