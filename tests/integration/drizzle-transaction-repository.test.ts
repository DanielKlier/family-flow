import { describe, expect, it } from "vitest";

import { DrizzleTransactionRepository } from "../../src/adapters/db/drizzle-transaction-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { expectTransactionFilterContract } from "../support/transaction-repository-contract.js";
import { aTransaction } from "../support/transactions.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle transaction repository", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "stores, filters, updates, and deletes transactions",
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
        });

        const rent = aTransaction({
          id: "transaction-drizzle-rent",
          accountId: "account-shared-checking",
          categoryId: "category-housing-rent",
          date: "2026-07-01",
          amountCents: -120000,
          description: "Drizzle rent",
          payee: "Landlord",
          status: "planned",
          fixedCost: true,
        });

        await transactions.save(rent);

        await expect(
          transactions.list({ month: "2026-07", ownerContext: "shared" }),
        ).resolves.toEqual([rent]);

        await transactions.save({ ...rent, status: "booked", description: "Booked rent" });
        await expect(transactions.get(rent.id)).resolves.toMatchObject({
          description: "Booked rent",
          status: "booked",
        });

        await transactions.delete(rent.id);
        await expect(transactions.get(rent.id)).resolves.toBeNull();

        await expectTransactionFilterContract(transactions);
      } finally {
        await transactions.delete("transaction-drizzle-rent");
        await transactions.delete("transaction-filter-groceries");
        await transactions.delete("transaction-filter-rent");
        await connection.client.end();
      }
    },
  );
});
