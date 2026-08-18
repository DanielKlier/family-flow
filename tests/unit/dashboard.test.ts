import { describe, expect, it } from "vitest";
import {
  calculateDashboard,
  calculateHistoricalAverage,
} from "../../src/core/dashboard/dashboard.js";
import { calculateMonthlyForecast } from "../../src/core/forecasting/monthly-forecast.js";
import { createIncomePlan } from "../../src/core/income/income-plan.js";
import { aTransaction } from "../support/transactions.js";

const account = { id: "account-a", name: "Main", ownerContext: "person_a" as const, active: true };
const category = { id: "category-a", name: "Food", active: true };

function transaction(overrides: Parameters<typeof aTransaction>[0] = {}) {
  return aTransaction({ accountId: account.id, categoryId: category.id, ...overrides });
}

describe("dashboard calculations", () => {
  it("UNIT-FF-DASH-001-01 UNIT-FF-DASH-002-01 UNIT-FF-DASH-003-01 calculates reconciled filtered actuals and income", () => {
    const income = createIncomePlan({
      id: "income-a",
      ownerContext: "person_a",
      name: "Salary",
      amountCents: 300_000,
      startMonth: "2026-01",
      endMonth: null,
      active: true,
    });
    const result = calculateDashboard({
      selectedMonth: "2026-07",
      currentMonth: "2026-07",
      accounts: [account],
      categories: [category],
      transactions: [
        transaction({ id: "booked", date: "2026-07-01", amountCents: -10_000 }),
        transaction({ id: "planned", date: "2026-07-02", amountCents: -20_000, status: "planned" }),
        transaction({
          id: "transfer",
          date: "2026-07-03",
          amountCents: -30_000,
          internalTransfer: true,
        }),
      ],
      incomePlans: [income],
      incomeOverrides: [],
      filters: { ownerContext: "person_a" },
      currentDate: "2026-07-10",
    });

    expect(result).toMatchObject({
      incomeCents: 300_000,
      expenseCents: 10_000,
      balanceCents: 290_000,
    });
    expect(result.byCategory).toEqual([
      { id: category.id, name: category.name, amountCents: 10_000 },
    ]);
    expect(result.byAccount).toEqual([
      { id: account.id, name: account.name, ownerContext: "person_a", amountCents: 10_000 },
    ]);
  });

  it("UNIT-FF-DASH-004-01 anchors averages before the month, includes zero months, and rounds half up", () => {
    expect(
      calculateHistoricalAverage(
        [transaction({ date: "2026-03-01", amountCents: -1 })],
        "2026-04",
        6,
      ),
    ).toBe(0);
    expect(
      calculateHistoricalAverage(
        [transaction({ date: "2026-03-01", amountCents: -3 })],
        "2026-04",
        6,
      ),
    ).toBe(1);
  });

  it("UNIT-FF-FOR-001-01 UNIT-FF-FOR-004-01 keeps forecast components mutually exclusive", () => {
    const result = calculateMonthlyForecast(
      [
        transaction({ id: "fixed", date: "2026-07-01", amountCents: -1_000, fixedCost: true }),
        transaction({
          id: "planned",
          date: "2026-07-02",
          amountCents: -2_000,
          fixedCost: true,
          status: "planned",
        }),
        transaction({ id: "variable", date: "2026-07-03", amountCents: -3_000 }),
      ],
      { month: "2026-07", currentDate: "2026-07-31" },
    );

    expect(result).toEqual({
      bookedFixedCents: 1_000,
      openPlannedFixedCents: 2_000,
      bookedVariableCents: 3_000,
      extrapolatedBookedVariableCents: 3_000,
      totalCents: 6_000,
      elapsedDays: 31,
      daysInMonth: 31,
    });
  });

  it("UNIT-FF-FOR-002-01 UNIT-FF-FOR-003-01 extrapolates with leap-year days and half-up rounding", () => {
    const result = calculateMonthlyForecast(
      [transaction({ date: "2024-02-01", amountCents: -1 })],
      { month: "2024-02", currentDate: "2024-02-02" },
    );
    expect(result.extrapolatedBookedVariableCents).toBe(15);
    expect(result).toMatchObject({ elapsedDays: 2, daysInMonth: 29 });
  });
});
