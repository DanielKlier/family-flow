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

  it("UNIT-FF-INC-001-01 UNIT-FF-INC-002-01 rejects non-Gregorian months and unsafe income amounts", () => {
    expect(() =>
      createIncomePlan({
        id: "income-invalid-month",
        ownerContext: "person_a",
        name: "Invalid month",
        amountCents: 1,
        startMonth: "2026-13",
        endMonth: null,
        active: true,
      }),
    ).toThrow("Income start month must use YYYY-MM");

    expect(() =>
      createIncomePlan({
        id: "income-unsafe-amount",
        ownerContext: "person_a",
        name: "Unsafe amount",
        amountCents: Number.MAX_SAFE_INTEGER + 1,
        startMonth: "2026-01",
        endMonth: null,
        active: true,
      }),
    ).toThrow("Income amount must be a safe integer");
  });

  it("UNIT-FF-INC-004-01 UNIT-FF-INC-005-01 includes range boundaries, replaces with zero, excludes inactive plans, and rejects unsafe totals", () => {
    const bounded = createIncomePlan({
      id: "income-bounded",
      ownerContext: "person_a",
      name: "Bounded salary",
      amountCents: Number.MAX_SAFE_INTEGER,
      startMonth: "2026-01",
      endMonth: "2026-02",
      active: true,
    });
    const inactive = createIncomePlan({
      id: "income-inactive",
      ownerContext: "person_a",
      name: "Inactive salary",
      amountCents: 100,
      startMonth: "2026-01",
      endMonth: null,
      active: false,
    });
    const zeroOverride = createMonthlyIncomeOverride({
      id: "override-zero",
      incomePlanId: bounded.id,
      month: "2026-02",
      amountCents: 0,
      note: null,
    });

    expect(
      calculateMonthlyIncome([bounded, inactive], [zeroOverride], { month: "2026-02" }),
    ).toMatchObject({ totalCents: 0, entries: [{ incomePlanId: bounded.id, amountCents: 0 }] });
    expect(calculateMonthlyIncome([bounded], [], { month: "2026-03" })).toMatchObject({
      totalCents: 0,
    });
    expect(() =>
      calculateMonthlyIncome([bounded, { ...bounded, id: "income-overflow" }], [], {
        month: "2026-01",
      }),
    ).toThrow("Monthly income total must be a safe integer");
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
