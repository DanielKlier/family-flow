import { describe, expect, it } from "vitest";

import {
  createImportHash,
  detectDuplicateImportRows,
  normalizeCsvTransactionRow,
} from "../../src/core/imports/csv-import.js";

describe("csv imports", () => {
  it("normalizes German CSV transaction values", () => {
    expect(
      normalizeCsvTransactionRow({
        accountId: " account-person-a-checking ",
        date: "15.07.2026",
        amount: "-1.234,56",
        description: "  Kartenzahlung   SUPERMARKT  ",
        payee: "  Supermarkt GmbH  ",
      }),
    ).toEqual({
      accountId: "account-person-a-checking",
      date: "2026-07-15",
      amountCents: -123456,
      description: "Kartenzahlung SUPERMARKT",
      payee: "Supermarkt GmbH",
    });
  });

  it("normalizes short German CSV dates", () => {
    expect(
      normalizeCsvTransactionRow({
        accountId: "account-person-a-checking",
        date: "15.07.26",
        amount: "-42,99",
        description: "Card payment",
      }).date,
    ).toBe("2026-07-15");
  });

  it("creates stable import hashes from normalized duplicate keys", () => {
    const firstHash = createImportHash({
      accountId: "account-shared-checking",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Kartenzahlung Supermarkt",
    });

    const secondHash = createImportHash({
      accountId: " account-shared-checking ",
      date: "2026-07-15",
      amountCents: -4299,
      description: " kartenzahlung   supermarkt ",
    });

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates different import hashes for different payees", () => {
    const firstHash = createImportHash({
      accountId: "account-shared-checking",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Card payment",
      payee: "Shop A",
    });

    const secondHash = createImportHash({
      accountId: "account-shared-checking",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Card payment",
      payee: "Shop B",
    });

    expect(firstHash).not.toBe(secondHash);
  });

  it("normalizes payees for import hashes", () => {
    const firstHash = createImportHash({
      accountId: "account-shared-checking",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Card payment",
      payee: " Shop   A ",
    });

    const secondHash = createImportHash({
      accountId: "account-shared-checking",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Card payment",
      payee: "shop a",
    });

    expect(firstHash).toBe(secondHash);
  });

  it("marks existing and repeated import rows as duplicates", () => {
    const firstRow = normalizeCsvTransactionRow({
      accountId: "account-shared-checking",
      date: "15.07.2026",
      amount: "-42,99",
      description: "Kartenzahlung Supermarkt",
    });
    const duplicateRow = normalizeCsvTransactionRow({
      accountId: "account-shared-checking",
      date: "2026-07-15",
      amount: "-42.99",
      description: " kartenzahlung   supermarkt ",
    });
    const existingHash = createImportHash({
      accountId: "account-person-a-checking",
      date: "2026-07-14",
      amountCents: -899,
      description: "Existing payment",
    });

    expect(
      detectDuplicateImportRows(
        [
          firstRow,
          duplicateRow,
          {
            accountId: "account-person-a-checking",
            date: "2026-07-14",
            amountCents: -899,
            description: "Existing payment",
            payee: null,
          },
        ],
        new Set([existingHash]),
      ).map((row) => row.duplicate),
    ).toEqual([false, true, true]);
  });

  it("does not mark repeated rows as duplicates when payees differ", () => {
    const firstRow = normalizeCsvTransactionRow({
      accountId: "account-shared-checking",
      date: "15.07.2026",
      amount: "-42,99",
      description: "Card payment",
      payee: "Shop A",
    });
    const secondRow = normalizeCsvTransactionRow({
      accountId: "account-shared-checking",
      date: "15.07.2026",
      amount: "-42,99",
      description: "Card payment",
      payee: "Shop B",
    });

    expect(
      detectDuplicateImportRows([firstRow, secondRow], new Set()).map((row) => row.duplicate),
    ).toEqual([false, false]);
  });
});
