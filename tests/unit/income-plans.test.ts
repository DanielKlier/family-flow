import { describe, expect, it } from "vitest";

import {
  calculateMonthlyIncome,
  createIncomePlan,
  createMonthlyIncomeOverride,
} from "../../src/core/income/income-plan.js";

describe("income plans", () => {
  it("calculates active monthly income plans for a month", () => {
    const salary = createIncomePlan({
      id: "income-salary",
      ownerContext: "person_a",
      name: "Salary",
      amountCents: 350000,
      startMonth: "2026-01",
      endMonth: null,
      active: true,
    });
    const parentalLeave = createIncomePlan({
      id: "income-parental-leave",
      ownerContext: "person_b",
      name: "Parental leave",
      amountCents: 120000,
      startMonth: "2026-08",
      endMonth: "2026-12",
      active: true,
    });

    expect(calculateMonthlyIncome([salary, parentalLeave], [], { month: "2026-07" })).toEqual({
      month: "2026-07",
      totalCents: 350000,
      entries: [{ incomePlanId: "income-salary", name: "Salary", amountCents: 350000 }],
    });
  });

  it("uses monthly overrides instead of the recurring amount", () => {
    const salary = createIncomePlan({
      id: "income-salary",
      ownerContext: "person_a",
      name: "Salary",
      amountCents: 350000,
      startMonth: "2026-01",
      endMonth: null,
      active: true,
    });
    const override = createMonthlyIncomeOverride({
      id: "override-august",
      incomePlanId: "income-salary",
      month: "2026-08",
      amountCents: 180000,
      note: "Reduced salary",
    });

    expect(calculateMonthlyIncome([salary], [override], { month: "2026-08" }).totalCents).toBe(
      180000,
    );
  });

  it("filters monthly income by owner context", () => {
    const plans = [
      createIncomePlan({
        id: "income-a",
        ownerContext: "person_a",
        name: "Person A salary",
        amountCents: 350000,
        startMonth: "2026-01",
        endMonth: null,
        active: true,
      }),
      createIncomePlan({
        id: "income-b",
        ownerContext: "person_b",
        name: "Person B salary",
        amountCents: 250000,
        startMonth: "2026-01",
        endMonth: null,
        active: true,
      }),
    ];

    expect(
      calculateMonthlyIncome(plans, [], { month: "2026-07", ownerContext: "person_b" }),
    ).toMatchObject({ totalCents: 250000 });
  });

  it("rejects invalid income plan data", () => {
    expect(() =>
      createIncomePlan({
        id: "income-invalid",
        ownerContext: "person_a",
        name: "Invalid",
        amountCents: -1,
        startMonth: "2026-01",
        endMonth: null,
        active: true,
      }),
    ).toThrow("Income amount must be positive cents");
  });
});
