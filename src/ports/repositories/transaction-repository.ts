import type { OwnerContext } from "../../core/shared/owner-context.js";
import type { Transaction, TransactionStatus } from "../../core/transactions/transaction.js";

export type TransactionFilters = {
  month?: string;
  accountId?: string;
  ownerContext?: OwnerContext;
  categoryId?: string;
  status?: TransactionStatus;
};

export type TransactionRepository = {
  list(filters: TransactionFilters): Promise<Transaction[]>;
  get(id: string): Promise<Transaction | null>;
  save(transaction: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
};
