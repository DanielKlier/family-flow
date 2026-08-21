import { describe, expect, it } from "vitest";

describe("CSV import confirmation", () => {
  it("UNIT-FF-CSV-008-01: atomically confirms only eligible rows from an unexpired server batch", async () => {
    const { confirmCsvImportBatch } = await import("../../src/core/imports/confirm-csv-import.js");
    const calls: string[] = [];
    let savedTransactions: unknown[] = [];
    const persistence = {
      async withinTransaction<T>(work: () => Promise<T>): Promise<T> {
        calls.push("begin");
        try {
          const result = await work();
          calls.push("commit");
          return result;
        } catch (error: unknown) {
          calls.push("rollback");
          throw error;
        }
      },
      async consumePreviewBatch(input: {
        batchId: string;
        userId: string;
        accountId: string;
        now: Date;
      }) {
        calls.push(`consume:${input.batchId}`);
        return {
          id: input.batchId,
          userId: input.userId,
          accountId: input.accountId,
          expiresAt: new Date("2026-07-15T10:30:00.000Z"),
          outcomes: [
            {
              line: 2,
              outcome: "importable" as const,
              reason: null,
              transaction: {
                id: "transaction-imported",
                accountId: input.accountId,
                categoryId: "category-other",
                categoryOrigin: "fallback" as const,
                date: "2026-07-15",
                amountCents: -4299,
                description: "Server stored expense",
                payee: null,
                purpose: "Server stored purpose",
                importHash: "v2:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              },
            },
            { line: 3, outcome: "duplicate" as const, reason: "already-imported" as const },
            { line: 4, outcome: "ignored" as const, reason: "amount-not-negative" as const },
          ],
        };
      },
      async saveTransactions(transactions: unknown[]): Promise<void> {
        savedTransactions = transactions;
        calls.push(`save:${transactions.length}`);
      },
    };

    await expect(
      confirmCsvImportBatch({
        batchId: "batch-opaque-id",
        userId: "test-user",
        accountId: "account-shared-checking",
        now: new Date("2026-07-15T10:00:00.000Z"),
        persistence,
      }),
    ).resolves.toEqual({ importedCount: 1 });
    expect(calls).toEqual(["begin", "consume:batch-opaque-id", "save:1", "commit"]);
    expect(savedTransactions).toEqual([expect.objectContaining({ internalTransfer: false })]);
  });

  it("rejects an invalid stored internal-transfer action", async () => {
    const { confirmCsvImportBatch } = await import("../../src/core/imports/confirm-csv-import.js");
    const persistence = {
      async withinTransaction<T>(work: () => Promise<T>): Promise<T> {
        return work();
      },
      async consumePreviewBatch() {
        return {
          id: "batch",
          userId: "user",
          accountId: "account",
          expiresAt: new Date("2026-07-15T11:00:00Z"),
          outcomes: [
            {
              line: 2,
              outcome: "importable" as const,
              reason: null,
              transaction: {
                id: "transaction",
                accountId: "account",
                categoryId: "category-other",
                categoryOrigin: "fallback" as const,
                date: "2026-07-15",
                amountCents: -100,
                description: "Settlement",
                payee: null,
                purpose: null,
                importHash: "v3:invalid-transfer-snapshot",
                internalTransfer: "mark",
              },
            },
          ],
        };
      },
      async saveTransactions() {},
    };

    await expect(
      confirmCsvImportBatch({
        batchId: "batch",
        userId: "user",
        now: new Date("2026-07-15T10:00:00Z"),
        persistence,
      }),
    ).rejects.toThrow("internal-transfer state is invalid");
  });

  it("rejects the complete batch when a stored row is invalid", async () => {
    const { confirmCsvImportBatch } = await import("../../src/core/imports/confirm-csv-import.js");
    let saved = false;
    const persistence = {
      async withinTransaction<T>(work: () => Promise<T>): Promise<T> {
        return work();
      },
      async consumePreviewBatch() {
        return {
          id: "batch",
          userId: "user",
          accountId: "account",
          expiresAt: new Date("2026-07-15T11:00:00Z"),
          outcomes: [{ line: 2, outcome: "invalid" as const, reason: "invalid-amount" as const }],
        };
      },
      async saveTransactions() {
        saved = true;
      },
    };
    await expect(
      confirmCsvImportBatch({
        batchId: "batch",
        userId: "user",
        now: new Date("2026-07-15T10:00:00Z"),
        persistence,
      }),
    ).rejects.toThrow("invalid rows");
    expect(saved).toBe(false);
  });
});
