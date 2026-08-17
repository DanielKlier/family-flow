import { describe, expect, it } from "vitest";

import { createTransaction } from "../../src/core/transactions/transaction.js";

describe("localized domain boundaries", () => {
  it("UNIT-FF-LOC-003-02 keeps canonical minor-unit amounts and ISO dates locale-neutral in the core", () => {
    const transaction = createTransaction({
      id: "transaction-localization-boundary",
      accountId: "account-a",
      categoryId: "category-a",
      date: "2026-12-31",
      amountCents: -123456,
      description: "Canonical transaction",
      payee: null,
      source: "manual",
      status: "booked",
      fixedCost: false,
      internalTransfer: false,
      note: null,
    });

    expect(transaction).toMatchObject({ date: "2026-12-31", amountCents: -123456 });
  });

  it("UNIT-FF-ARC-007-01 exposes a typed domain error instead of an English validation message", () => {
    let error: unknown;
    try {
      createTransaction({
        id: "transaction-localization-boundary",
        accountId: "account-a",
        categoryId: "category-a",
        date: "31.12.2026",
        amountCents: -100,
        description: "Invalid canonical date",
        payee: null,
        source: "manual",
        status: "booked",
        fixedCost: false,
        internalTransfer: false,
        note: null,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "invalid_date" });
  });
});
