import type { Account } from "../../core/accounts/account.js";
import type { Transaction } from "../../core/transactions/transaction.js";
import type {
  TransactionFilters,
  TransactionRepository,
} from "../../ports/repositories/transaction-repository.js";

export class InMemoryTransactionRepository implements TransactionRepository {
  readonly #transactions = new Map<string, Transaction>();
  readonly #accounts = new Map<string, Account>();

  constructor(accounts: Account[] = [], transactions: Transaction[] = []) {
    for (const account of accounts) {
      this.#accounts.set(account.id, account);
    }
    for (const transaction of transactions) {
      this.#transactions.set(transaction.id, transaction);
    }
  }

  async list(filters: TransactionFilters): Promise<Transaction[]> {
    return [...this.#transactions.values()]
      .filter((transaction) => matchesFilters(transaction, filters, this.#accounts))
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) || left.description.localeCompare(right.description),
      );
  }

  async get(id: string): Promise<Transaction | null> {
    return this.#transactions.get(id) ?? null;
  }

  async save(transaction: Transaction): Promise<void> {
    this.#transactions.set(transaction.id, transaction);
  }

  async delete(id: string): Promise<void> {
    this.#transactions.delete(id);
  }
}

function matchesFilters(
  transaction: Transaction,
  filters: TransactionFilters,
  accounts: Map<string, Account>,
): boolean {
  if (filters.month !== undefined && !transaction.date.startsWith(`${filters.month}-`)) {
    return false;
  }
  if (filters.accountId !== undefined && transaction.accountId !== filters.accountId) {
    return false;
  }
  if (filters.categoryId !== undefined && transaction.categoryId !== filters.categoryId) {
    return false;
  }
  if (filters.status !== undefined && transaction.status !== filters.status) {
    return false;
  }
  if (filters.ownerContext !== undefined) {
    return accounts.get(transaction.accountId)?.ownerContext === filters.ownerContext;
  }

  return true;
}
