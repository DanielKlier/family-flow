import { describe, expect, it } from "vitest";

import { InMemoryIncomeRepository } from "../../src/adapters/db/in-memory-income-repository.js";
import { createMonthlyIncomeOverride } from "../../src/core/income/income-plan.js";
import { anIncomePlan } from "../support/income-plans.js";

describe("income repositories", () => {
  it("stores income plans, filters by owner context, and stores monthly overrides", async () => {
    const repository = new InMemoryIncomeRepository();
    const salary = anIncomePlan({ id: "income-salary", ownerContext: "person_a" });
    const childBenefit = anIncomePlan({
      id: "income-child-benefit",
      ownerContext: "shared",
      name: "Child benefit",
      amountCents: 25000,
    });
    const override = createMonthlyIncomeOverride({
      id: "override-salary-august",
      incomePlanId: salary.id,
      month: "2026-08",
      amountCents: 180000,
      note: "Reduced salary",
    });

    await repository.savePlan(salary);
    await repository.savePlan(childBenefit);
    await repository.saveOverride(override);

    await expect(repository.listPlans({ ownerContext: "shared" })).resolves.toEqual([childBenefit]);
    await expect(repository.listOverrides({ month: "2026-08" })).resolves.toEqual([override]);

    await repository.savePlan({ ...salary, name: "Updated salary" });
    await expect(repository.getPlan(salary.id)).resolves.toMatchObject({ name: "Updated salary" });
  });
});
