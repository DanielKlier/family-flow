import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import type {
  ConfirmableImportTransaction,
  StoredImportOutcome,
} from "../../core/imports/confirm-csv-import.js";
import { createImportProfile, type ImportProfile } from "../../core/imports/import-profile.js";
import type { Transaction } from "../../core/transactions/transaction.js";
import type {
  ImportPreviewBatch,
  ImportPreviewBatchRepository,
} from "../../ports/repositories/import-preview-batch-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { importPreviewBatches, transactions } from "./schema.js";

type TransactionCallback = Parameters<PostgresDatabase["transaction"]>[0];
type ImportDatabase = Parameters<TransactionCallback>[0];

export class DrizzleImportPreviewBatchRepository implements ImportPreviewBatchRepository {
  readonly #transaction = new AsyncLocalStorage<ImportDatabase>();

  constructor(private readonly db: PostgresDatabase) {}

  async save(batch: ImportPreviewBatch): Promise<void> {
    await this.db.insert(importPreviewBatches).values({
      id: batch.id,
      userId: batch.userId,
      accountId: batch.accountId,
      createdAt: batch.createdAt,
      expiresAt: batch.expiresAt,
      profileSnapshot: batch.profileSnapshot,
      outcomeSnapshot: batch.outcomes,
    });
  }

  async withinTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => this.#transaction.run(transaction, work));
  }

  async consumePreviewBatch(input: {
    batchId: string;
    userId: string;
    accountId?: string;
    now: Date;
  }): Promise<ImportPreviewBatch | null> {
    const db = this.requireTransaction();
    const conditions = [
      eq(importPreviewBatches.id, input.batchId),
      eq(importPreviewBatches.userId, input.userId),
      isNull(importPreviewBatches.consumedAt),
      gt(importPreviewBatches.expiresAt, input.now),
    ];
    if (input.accountId !== undefined)
      conditions.push(eq(importPreviewBatches.accountId, input.accountId));
    const [row] = await db
      .update(importPreviewBatches)
      .set({ consumedAt: input.now })
      .where(and(...conditions))
      .returning();
    if (row === undefined) return null;

    return {
      id: row.id,
      userId: row.userId,
      accountId: row.accountId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      profileSnapshot: parseProfile(row.profileSnapshot),
      outcomes: parseOutcomes(row.outcomeSnapshot),
    };
  }

  async saveTransactions(imported: Transaction[]): Promise<void> {
    if (imported.length === 0) return;
    const inserted = await this.requireTransaction()
      .insert(transactions)
      .values(imported)
      .onConflictDoNothing({
        target: [transactions.accountId, transactions.importHash],
        where: sql`${transactions.importHash} is not null`,
      })
      .returning({ id: transactions.id });
    if (inserted.length > 0 && inserted.length !== imported.length) {
      throw new Error("Import confirmation encountered a partial import conflict");
    }
  }

  private requireTransaction(): ImportDatabase {
    const transaction = this.#transaction.getStore();
    if (transaction === undefined) throw new Error("Import confirmation requires a transaction");
    return transaction;
  }
}

function parseProfile(value: unknown): ImportProfile {
  if (typeof value !== "object" || value === null)
    throw new Error("Import profile snapshot is invalid");
  return createImportProfile(value as ImportProfile);
}

function parseOutcomes(value: unknown): StoredImportOutcome[] {
  if (!Array.isArray(value)) throw invalidOutcomeSnapshot();
  return value.map(parseOutcome);
}

function parseOutcome(value: unknown): StoredImportOutcome {
  if (!isRecord(value) || !isImportLine(value.line) || typeof value.outcome !== "string") {
    throw invalidOutcomeSnapshot();
  }
  const { line, outcome, reason } = value;
  if (outcome === "duplicate" && reason === "already-imported") return { line, outcome, reason };
  if (outcome === "ignored" && reason === "amount-not-negative") return { line, outcome, reason };
  if (
    outcome === "invalid" &&
    (reason === "invalid-date" || reason === "invalid-amount" || reason === "missing-description")
  ) {
    return { line, outcome, reason };
  }
  if (outcome === "importable" && reason === null) {
    return { line, outcome, reason, transaction: parseImportTransaction(value.transaction) };
  }
  throw invalidOutcomeSnapshot();
}

function parseImportTransaction(value: unknown): ConfirmableImportTransaction {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.accountId) ||
    !isNonEmptyString(value.categoryId) ||
    !isNonEmptyString(value.date) ||
    typeof value.amountCents !== "number" ||
    !Number.isSafeInteger(value.amountCents) ||
    !isNonEmptyString(value.description) ||
    !isNullableString(value.payee) ||
    !isNullableString(value.purpose) ||
    !isNonEmptyString(value.importHash) ||
    (value.fixedCost !== undefined && typeof value.fixedCost !== "boolean")
  ) {
    throw invalidOutcomeSnapshot();
  }
  return {
    id: value.id,
    accountId: value.accountId,
    categoryId: value.categoryId,
    date: value.date,
    amountCents: value.amountCents,
    description: value.description,
    payee: value.payee,
    purpose: value.purpose,
    importHash: value.importHash,
    ...(value.fixedCost === undefined ? {} : { fixedCost: value.fixedCost }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isImportLine(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 2;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function invalidOutcomeSnapshot(): Error {
  return new Error("Import outcome snapshot is invalid");
}
