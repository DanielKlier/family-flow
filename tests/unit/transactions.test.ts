import { describe, expect, it } from "vitest";

import { createTransaction } from "../../src/core/transactions/transaction.js";

describe("transactions", () => {
  it("creates a valid manual booked expense", () => {
    expect(
      createTransaction({
        id: "transaction-1",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "2026-07-15",
        amountCents: -4299,
        description: "Groceries",
        payee: "Market",
        source: "manual",
        status: "booked",
        fixedCost: false,
        note: "weekly shop",
      }),
    ).toMatchObject({
      id: "transaction-1",
      amountCents: -4299,
      source: "manual",
      status: "booked",
    });
  });

  it("rejects non-expense amounts", () => {
    expect(() =>
      createTransaction({
        id: "transaction-1",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "2026-07-15",
        amountCents: 100,
        description: "Refund",
        payee: null,
        source: "manual",
        status: "booked",
        fixedCost: false,
        note: null,
      }),
    ).toThrow("Transaction amount must be a negative expense");
  });

  it("rejects invalid dates and statuses", () => {
    expect(() =>
      createTransaction({
        id: "transaction-1",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "15.07.2026",
        amountCents: -100,
        description: "Groceries",
        payee: null,
        source: "manual",
        status: "paid",
        fixedCost: false,
        note: null,
      }),
    ).toThrow("Transaction date must use YYYY-MM-DD");
  });
});
