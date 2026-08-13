import { describe, expect, it } from "vitest";

import { createManualExpense, createTransaction } from "../../src/core/transactions/transaction.js";
import { aTransaction } from "../support/transactions.js";

describe("transactions", () => {
  it("creates a valid manual booked expense", () => {
    expect(aTransaction({ note: "weekly shop" })).toMatchObject({
      id: "transaction-1",
      amountCents: -4299,
      source: "manual",
      status: "booked",
    });
  });

  it("rejects non-expense amounts", () => {
    expect(() => aTransaction({ amountCents: 100, description: "Refund" })).toThrow(
      "Transaction amount must be a negative expense",
    );
  });

  it("rejects invalid dates", () => {
    expect(() => aTransaction({ date: "15.07.2026", amountCents: -100 })).toThrow(
      "Transaction date must use YYYY-MM-DD",
    );
  });

  it("creates manual expenses from positive decimal input", () => {
    expect(
      createManualExpense({
        id: "transaction-1",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "2026-07-15",
        amount: "42,99",
        description: "Groceries",
        payee: "Market",
        status: "planned",
        fixedCost: true,
        note: "weekly shop",
      }),
    ).toMatchObject({
      amountCents: -4299,
      source: "manual",
      status: "planned",
      fixedCost: true,
    });
  });

  it("UNIT-FF-TXN-001-01: preserves a normalized purpose for imported transactions", () => {
    const importedInput = {
      id: "transaction-imported-1",
      accountId: "account-shared-checking",
      categoryId: "category-groceries",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Card payment",
      payee: "Shop",
      purpose: "  Weekly groceries  ",
      source: "csv" as const,
      status: "booked" as const,
      fixedCost: false,
      note: null,
      importHash: "v2:immutable-import-hash",
    };

    expect(createTransaction(importedInput)).toMatchObject({
      purpose: "Weekly groceries",
      source: "csv",
      importHash: "v2:immutable-import-hash",
    });
  });

  it("UNIT-FF-TXN-001-02: rejects unsafe integer transaction amounts", () => {
    expect(() => aTransaction({ amountCents: -9007199254740992 })).toThrow(
      "Transaction amount must be a negative safe integer expense",
    );
  });

  it("rejects invalid manual expense amounts", () => {
    expect(() =>
      createManualExpense({
        id: "transaction-1",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "2026-07-15",
        amount: "-42.99",
        description: "Groceries",
      }),
    ).toThrow("Amount must be a positive decimal expense");
  });
});
