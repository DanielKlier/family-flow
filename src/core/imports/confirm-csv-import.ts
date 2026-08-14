import { createTransaction, type Transaction } from "../transactions/transaction.js";

export type ConfirmableImportTransaction = Pick<
  Transaction,
  | "id"
  | "accountId"
  | "categoryId"
  | "date"
  | "amountCents"
  | "description"
  | "payee"
  | "purpose"
  | "importHash"
> & { fixedCost?: boolean; internalTransfer?: boolean };

export type StoredImportOutcome =
  | {
      line: number;
      outcome: "importable";
      reason: null;
      transaction: ConfirmableImportTransaction;
    }
  | { line: number; outcome: "duplicate"; reason: "already-imported" }
  | { line: number; outcome: "ignored"; reason: "amount-not-negative" }
  | {
      line: number;
      outcome: "invalid";
      reason: "invalid-date" | "invalid-amount" | "missing-description";
    };

export type ConfirmableImportBatch = {
  id: string;
  userId: string;
  accountId: string;
  expiresAt: Date;
  outcomes: StoredImportOutcome[];
};

export type ImportConfirmationPersistence = {
  withinTransaction<T>(work: () => Promise<T>): Promise<T>;
  consumePreviewBatch(input: {
    batchId: string;
    userId: string;
    accountId?: string;
    now: Date;
  }): Promise<ConfirmableImportBatch | null>;
  saveTransactions(transactions: Transaction[]): Promise<void>;
};

export async function confirmCsvImportBatch(input: {
  batchId: string;
  userId: string;
  accountId?: string;
  now: Date;
  persistence: ImportConfirmationPersistence;
}): Promise<{ importedCount: number }> {
  return input.persistence.withinTransaction(async () => {
    const batch = await input.persistence.consumePreviewBatch({
      batchId: input.batchId,
      userId: input.userId,
      accountId: input.accountId,
      now: input.now,
    });
    if (batch === null) throw new Error("Import preview batch is invalid or expired");

    if (batch.outcomes.some((outcome) => outcome.outcome === "invalid")) {
      throw new Error("Import preview batch contains invalid rows");
    }
    const transactions = batch.outcomes.flatMap((outcome) => {
      if (outcome.outcome !== "importable") return [];
      if (outcome.transaction.accountId !== batch.accountId) {
        throw new Error("Import preview batch account binding is invalid");
      }
      return [
        createTransaction({
          ...outcome.transaction,
          source: "csv",
          status: "booked",
          fixedCost: outcome.transaction.fixedCost ?? false,
          internalTransfer: readInternalTransfer(outcome.transaction.internalTransfer),
          note: null,
        }),
      ];
    });
    await input.persistence.saveTransactions(transactions);
    return { importedCount: transactions.length };
  });
}

function readInternalTransfer(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value === "boolean") return value;
  throw new Error("Import outcome snapshot internal-transfer state is invalid");
}
