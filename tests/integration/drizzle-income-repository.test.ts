import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { DrizzleIncomeRepository } from "../../src/adapters/db/drizzle-income-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { incomePlans, monthlyIncomeOverrides } from "../../src/adapters/db/schema.js";
import { createMonthlyIncomeOverride } from "../../src/core/income/income-plan.js";
import { anIncomePlan } from "../support/income-plans.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle income repository", () => {
  it.runIf(testDatabaseUrl !== undefined)("stores income plans and monthly overrides", async () => {
    if (testDatabaseUrl === undefined) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    await migrate(testDatabaseUrl);

    const connection = createPostgresConnection(testDatabaseUrl);
    const repository = new DrizzleIncomeRepository(connection.db);
    const salary = anIncomePlan({ id: "income-drizzle-salary", ownerContext: "person_a" });
    const override = createMonthlyIncomeOverride({
      id: "override-drizzle-salary-august",
      incomePlanId: salary.id,
      month: "2026-08",
      amountCents: 180000,
      note: "Reduced salary",
    });

    try {
      await repository.savePlan(salary);
      await repository.saveOverride(override);

      await expect(repository.listPlans({ ownerContext: "person_a" })).resolves.toContainEqual(
        salary,
      );
      await expect(repository.listOverrides({ month: "2026-08" })).resolves.toContainEqual(
        override,
      );
    } finally {
      await connection.db
        .delete(monthlyIncomeOverrides)
        .where(eq(monthlyIncomeOverrides.id, override.id));
      await connection.db.delete(incomePlans).where(eq(incomePlans.id, salary.id));
      await connection.client.end();
    }
  });
});
