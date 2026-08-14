import { describe, expect, it } from "vitest";
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
    "INT-FF-TXN-001-01 INT-FF-TXN-001-03 INT-FF-TXN-004-01 INT-FF-TXN-005-01: persists the transfer default and transfer-state round trips",
    async () => {
      if (testDatabaseUrl === undefined) {
        throw new Error("TEST_DATABASE_URL is required");
      }

      await migrate(testDatabaseUrl);

      const connection = createPostgresConnection(testDatabaseUrl);
      const transactions = new DrizzleTransactionRepository(connection.db);

      try {
        await seedMasterData({
          accounts: new DrizzleAccountRepository(connection.db),
          categories: new DrizzleCategoryRepository(connection.db),
          ownerContexts: new DrizzleOwnerContextRepository(connection.db),
        });

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

        await transactions.save({ ...markedRent, status: "booked", description: "Booked rent" });
        await expect(transactions.get(rent.id)).resolves.toMatchObject({
          description: "Booked rent",
          purpose: "Imported purpose",
          importHash: "v2:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          status: "booked",
          internalTransfer: true,
        });

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
