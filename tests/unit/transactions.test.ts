import { describe, expect, it } from "vitest";

import * as transactionCore from "../../src/core/transactions/transaction.js";
import {
  categoryOriginAfterEdit,
  createManualExpense,
  createTransaction,
} from "../../src/core/transactions/transaction.js";
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
      expect.objectContaining({ code: "non_expense_amount" }),
    );
  });

  it("rejects invalid dates", () => {
    expect(() => aTransaction({ date: "15.07.2026", amountCents: -100 })).toThrow(
      expect.objectContaining({ code: "invalid_date" }),
    );
  });

  it("creates manual expenses from positive decimal input", () => {
    expect(
      createManualExpense({
        id: "transaction-1",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "2026-07-15",
        amountCents: -4299,
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
      categoryOrigin: "legacy_preserved" as const,
      source: "csv" as const,
      status: "booked" as const,
      fixedCost: false,
      note: null,
      importHash: "v2:immutable-import-hash",
    };

    expect(createTransaction(importedInput)).toMatchObject({
      purpose: "Weekly groceries",
      categoryOrigin: "legacy_preserved",
      source: "csv",
      importHash: "v2:immutable-import-hash",
    });
  });

  it("UNIT-FF-TXN-001-04: preserves origin unless the user changes the category", () => {
    expect(categoryOriginAfterEdit("category-other", "fallback", "category-other")).toBe(
      "fallback",
    );
    expect(categoryOriginAfterEdit("category-other", "fallback", "category-groceries")).toBe(
      "manual",
    );
  });

  it("UNIT-FF-TXN-005-01: defaults internal transfers to false and preserves explicit transfer state", () => {
    const unmarked = aTransaction();
    const marked = createTransaction({
      ...unmarked,
      id: "transaction-marked-transfer",
      internalTransfer: true,
    } as Parameters<typeof createTransaction>[0] & { internalTransfer: boolean });
    const explicitlyUnmarked = createTransaction({
      ...unmarked,
      id: "transaction-explicitly-unmarked-transfer",
      internalTransfer: false,
    } as Parameters<typeof createTransaction>[0] & { internalTransfer: boolean });

    expect(Reflect.get(unmarked, "internalTransfer")).toBe(false);
    expect(Reflect.get(marked, "internalTransfer")).toBe(true);
    expect(Reflect.get(explicitlyUnmarked, "internalTransfer")).toBe(false);
  });

  it("UNIT-FF-TXN-006-01: excludes marked transfer legs from the reusable expense total", () => {
    const expenseTotalCents = Reflect.get(transactionCore, "expenseTotalCents");
    expect(expenseTotalCents).toBeTypeOf("function");
    if (typeof expenseTotalCents !== "function") {
      throw new Error("expenseTotalCents must be exported");
    }

    const normalExpense = aTransaction({ id: "normal-expense", amountCents: -4299 });
    const markedLeg = createTransaction({
      ...aTransaction({ id: "marked-transfer-leg", amountCents: -10000 }),
      internalTransfer: true,
    } as Parameters<typeof createTransaction>[0] & { internalTransfer: boolean });
    const secondMarkedLeg = createTransaction({
      ...aTransaction({ id: "second-marked-transfer-leg", amountCents: -10000 }),
      internalTransfer: true,
    } as Parameters<typeof createTransaction>[0] & { internalTransfer: boolean });

    expect(expenseTotalCents([normalExpense])).toBe(-4299);
    expect(expenseTotalCents([markedLeg])).toBe(0);
    expect(expenseTotalCents([markedLeg, secondMarkedLeg])).toBe(0);
    expect(expenseTotalCents([normalExpense, markedLeg])).toBe(-4299);
  });

  it("UNIT-FF-DASH-001-01 rejects an unsafe reusable expense total instead of returning an imprecise amount", () => {
    const maximumExpense = aTransaction({
      id: "maximum-expense",
      amountCents: -2147483648,
    });
    const overflowingExpenses = new Array<typeof maximumExpense>(2 ** 22).fill(maximumExpense);

    expect(() => transactionCore.expenseTotalCents(overflowingExpenses)).toThrow(
      "Expense total must be a safe integer",
    );
  });

  it("UNIT-FF-TXN-001-02: rejects unsafe integer transaction amounts", () => {
    expect(() => aTransaction({ amountCents: -9007199254740992 })).toThrow(
      expect.objectContaining({ code: "invalid_amount" }),
    );
  });

  it("rejects invalid manual expense amounts", () => {
    expect(() =>
      createManualExpense({
        id: "transaction-1",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "2026-07-15",
        amountCents: Number.NaN,
        description: "Groceries",
      }),
    ).toThrow(expect.objectContaining({ code: "invalid_amount" }));
  });
});
