import { describe, expect, it } from "vitest";

import {
  createImportHash,
  createImportHashCandidates,
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
      purpose: null,
    });
  });

  it("parses minor units exactly and rejects unsafe or malformed amounts", () => {
    expect(
      normalizeCsvTransactionRow({
        accountId: "account",
        date: "2026-07-15",
        amount: "-90071992547409.91",
        description: "Largest safe expense",
      }).amountCents,
    ).toBe(Number.MIN_SAFE_INTEGER);

    for (const amount of ["-90071992547409.92", `-${"9".repeat(400)}.00`, "-1.2.3,45"]) {
      expect(() =>
        normalizeCsvTransactionRow({
          accountId: "account",
          date: "2026-07-15",
          amount,
          description: "Invalid expense",
        }),
      ).toThrow("CSV amount");
    }
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

  it("UNIT-FF-CSV-005-01: creates framed v3 hashes for NFKC-equivalent import identities", () => {
    const firstHash = createImportHash({
      accountId: "account-shared-checking",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Cafe\u0301 purchase",
      payee: "Shop",
    });
    const equivalentHash = createImportHash({
      accountId: "account-shared-checking",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Café purchase",
      payee: "Shop",
    });

    expect(firstHash).toMatch(/^v3:[a-f0-9]{64}$/);
    expect(equivalentHash).toBe(firstHash);
  });

  it("UNIT-FF-CSV-005-02: frames identity fields so tuple delimiters cannot collide", () => {
    const firstHash = createImportHash({
      accountId: "account|shared",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Coffee",
      payee: "Shop",
    });
    const secondHash = createImportHash({
      accountId: "account",
      date: "shared|2026-07-15",
      amountCents: -4299,
      description: "Coffee",
      payee: "Shop",
    });

    expect(firstHash).not.toBe(secondHash);
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
    expect(firstHash).toMatch(/^v3:[a-f0-9]{64}$/);
  });

  it("UNIT-FF-CSV-012-02: makes v3 identity purpose-sensitive and recognizes historical hashes only for matching purposes", () => {
    const base = {
      accountId: "account",
      date: "2026-07-15",
      amountCents: -100,
      description: "Expense",
      payee: "Shop",
    };
    const january = { ...base, purpose: " January   groceries " };
    const januaryEquivalent = { ...base, purpose: "JANUARY groceries" };
    const february = { ...base, purpose: "February groceries" };
    const blankPurpose = { ...base, purpose: " " };
    const nullPurpose = { ...base, purpose: null };

    expect(createImportHash(january)).toMatch(/^v3:[a-f0-9]{64}$/);
    expect(createImportHash(januaryEquivalent)).toBe(createImportHash(january));
    expect(createImportHash(february)).not.toBe(createImportHash(january));
    expect(createImportHash(blankPurpose)).toBe(createImportHash(nullPurpose));
    expect(
      detectDuplicateImportRows([january, february, januaryEquivalent], []).map(
        (row) => row.duplicate,
      ),
    ).toEqual([false, false, true]);

    const historicalHashes = [...createImportHashCandidates(january)].filter(
      (hash) => !hash.startsWith("v3:"),
    );
    expect(historicalHashes).toHaveLength(2);

    // Existing identities must retain their persisted purpose so v1/v2 can be
    // safely matched even though their immutable hashes omit it.
    for (const historicalHash of historicalHashes) {
      expect(
        detectDuplicateImportRows(
          [january, february, nullPurpose],
          [{ importHash: historicalHash, purpose: "January groceries" }],
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ duplicate: true }),
          expect.objectContaining({ duplicate: false }),
          expect.objectContaining({ duplicate: false }),
        ]),
      );
      expect(
        detectDuplicateImportRows([january], [{ importHash: historicalHash, purpose: null }])[0]
          ?.duplicate,
      ).toBe(false);
    }
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

  it("UNIT-FF-CSV-004-01: marks existing and repeated import rows as duplicates", () => {
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
        [{ importHash: existingHash, purpose: null }],
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
      detectDuplicateImportRows([firstRow, secondRow], []).map((row) => row.duplicate),
    ).toEqual([false, false]);
  });
});
