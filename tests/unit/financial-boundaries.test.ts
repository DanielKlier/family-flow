import { describe, expect, it } from "vitest";

import { createManualExpense, expenseTotalCents } from "../../src/core/transactions/transaction.js";
import { aTransaction } from "../support/transactions.js";

describe("financial boundaries", () => {
  it("UNIT-FF-ARC-006-01: accepts real Gregorian dates and PostgreSQL integer cents only", () => {
    expect(aTransaction({ date: "2024-02-29", amountCents: -2147483648 })).toMatchObject({
      date: "2024-02-29",
      amountCents: -2147483648,
    });

    for (const date of ["2026-02-29", "2026-02-30"]) {
      expect(() => aTransaction({ date })).toThrow(
        expect.objectContaining({ code: "invalid_date" }),
      );
    }
    for (const amountCents of [-1.5, -2147483649, -Number.MAX_SAFE_INTEGER - 1]) {
      expect(() => aTransaction({ amountCents })).toThrow(
        expect.objectContaining({ code: "invalid_amount" }),
      );
    }
    expect(() =>
      expenseTotalCents([
        { ...aTransaction({ id: "total-first" }), amountCents: -Number.MAX_SAFE_INTEGER },
        aTransaction({ id: "total-second", amountCents: -1 }),
      ]),
    ).toThrow(expect.objectContaining({ code: "unsafe_expense_total" }));
  });

  it("UNIT-FF-ARC-006-02: stores manual expense values as exact negative integer cents", () => {
    expect(
      createManualExpense({
        id: "manual-integer-cents",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "2026-07-15",
        amountCents: -120000,
        description: "Rent",
      }).amountCents,
    ).toBe(-120000);
  });
});
