import { eq, inArray } from "drizzle-orm";
import { expect, it } from "vitest";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleIncomeRepository } from "../../src/adapters/db/drizzle-income-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { DrizzleTransactionRepository } from "../../src/adapters/db/drizzle-transaction-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { incomePlans, transactions } from "../../src/adapters/db/schema.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { calculateDashboard } from "../../src/core/dashboard/dashboard.js";
import { anIncomePlan } from "../support/income-plans.js";
import { aTransaction } from "../support/transactions.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

it.runIf(testDatabaseUrl !== undefined)(
  "INT-FF-DASH-001-01 queries canonical PostgreSQL fixtures for exact dashboard calculation",
  async () => {
    if (testDatabaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
    await migrate(testDatabaseUrl);
    const connection = createPostgresConnection(testDatabaseUrl);
    const accountRepository = new DrizzleAccountRepository(connection.db);
    const categoryRepository = new DrizzleCategoryRepository(connection.db);
    const incomeRepository = new DrizzleIncomeRepository(connection.db);
    const transactionRepository = new DrizzleTransactionRepository(connection.db);
    const salary = anIncomePlan({ id: "dashboard-postgres-salary", amountCents: 300_000 });
    const fixtureTransactions = [
      aTransaction({ id: "dashboard-postgres-booked", amountCents: -12_345 }),
      aTransaction({
        id: "dashboard-postgres-planned",
        amountCents: -20_000,
        status: "planned",
        fixedCost: true,
      }),
      aTransaction({
        id: "dashboard-postgres-transfer",
        amountCents: -50_000,
        internalTransfer: true,
      }),
    ];

    try {
      await seedMasterData(
        {
          accounts: accountRepository,
          categories: categoryRepository,
          ownerContexts: new DrizzleOwnerContextRepository(connection.db),
        },
        createGermanLocalization(),
      );
      await incomeRepository.savePlan(salary);
      for (const transaction of fixtureTransactions) await transactionRepository.save(transaction);

      const result = calculateDashboard({
        selectedMonth: "2026-07",
        currentMonth: "2026-07",
        currentDate: "2026-07-31",
        accounts: await accountRepository.list(),
        categories: await categoryRepository.list(),
        transactions: await transactionRepository.list({}),
        incomePlans: await incomeRepository.listPlans({}),
        incomeOverrides: await incomeRepository.listOverrides({}),
        filters: {},
      });

      expect(result).toMatchObject({
        incomeCents: 300_000,
        expenseCents: 12_345,
        balanceCents: 287_655,
        forecast: {
          bookedFixedCents: 0,
          openPlannedFixedCents: 20_000,
          extrapolatedBookedVariableCents: 12_345,
          totalCents: 32_345,
        },
      });
      expect(result.byCategory.reduce((total, row) => total + row.amountCents, 0)).toBe(12_345);
      expect(result.byAccount.reduce((total, row) => total + row.amountCents, 0)).toBe(12_345);
    } finally {
      await connection.db.delete(transactions).where(
        inArray(
          transactions.id,
          fixtureTransactions.map(({ id }) => id),
        ),
      );
      await connection.db.delete(incomePlans).where(eq(incomePlans.id, salary.id));
      await connection.client.end();
    }
  },
);
