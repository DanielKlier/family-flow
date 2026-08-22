import type { Transaction } from "./transaction.js";

export type TransactionMaintenanceErrorCode = "unknown_account" | "unknown_category";

export class TransactionMaintenanceError extends Error {
  constructor(readonly code: TransactionMaintenanceErrorCode) {
    super(code);
    this.name = "TransactionMaintenanceError";
  }
}

type ReferenceRepository = {
  get(id: string): Promise<unknown | null>;
};

type TransactionPersistence = {
  accounts: ReferenceRepository;
  categories: ReferenceRepository;
  transactions: {
    save(transaction: Transaction): Promise<void>;
  };
};

export async function maintainTransaction(input: {
  transaction: Transaction;
  persistence: TransactionPersistence;
}): Promise<void> {
  const { transaction, persistence } = input;
  const [account, category] = await Promise.all([
    persistence.accounts.get(transaction.accountId),
    persistence.categories.get(transaction.categoryId),
  ]);

  if (account === null) throw new TransactionMaintenanceError("unknown_account");
  if (category === null) throw new TransactionMaintenanceError("unknown_category");

  await persistence.transactions.save(transaction);
}
