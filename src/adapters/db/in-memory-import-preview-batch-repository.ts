import type { Transaction } from "../../core/transactions/transaction.js";
import type {
  ImportPreviewBatch,
  ImportPreviewBatchRepository,
} from "../../ports/repositories/import-preview-batch-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";

export class InMemoryImportPreviewBatchRepository implements ImportPreviewBatchRepository {
  readonly #batches = new Map<string, ImportPreviewBatch>();
  #claimedBatchId: string | null = null;
  #pendingTransactions: Transaction[] = [];

  constructor(private readonly transactions: TransactionRepository) {}

  async save(batch: ImportPreviewBatch): Promise<void> {
    this.#batches.set(batch.id, structuredClone(batch));
  }

  async withinTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.#claimedBatchId !== null)
      throw new Error("Concurrent in-memory transaction is unsupported");
    try {
      const result = await work();
      for (const transaction of this.#pendingTransactions)
        await this.transactions.save(transaction);
      if (this.#claimedBatchId !== null) this.#batches.delete(this.#claimedBatchId);
      return result;
    } finally {
      this.#claimedBatchId = null;
      this.#pendingTransactions = [];
    }
  }

  async consumePreviewBatch(input: {
    batchId: string;
    userId: string;
    accountId?: string;
    now: Date;
  }): Promise<ImportPreviewBatch | null> {
    const batch = this.#batches.get(input.batchId);
    if (
      batch === undefined ||
      batch.userId !== input.userId ||
      (input.accountId !== undefined && batch.accountId !== input.accountId) ||
      batch.expiresAt.getTime() <= input.now.getTime()
    )
      return null;
    this.#claimedBatchId = batch.id;
    return structuredClone(batch);
  }

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    const existing = await this.transactions.list({});
    const hashes = new Set(existing.map((row) => row.importHash).filter((hash) => hash !== null));
    this.#pendingTransactions = transactions.filter((transaction) => {
      if (transaction.importHash === null || hashes.has(transaction.importHash)) return false;
      hashes.add(transaction.importHash);
      return true;
    });
    if (
      this.#pendingTransactions.length > 0 &&
      this.#pendingTransactions.length !== transactions.length
    ) {
      throw new Error("Import confirmation encountered a partial import conflict");
    }
  }
}
