import {
  createTransaction,
  type Transaction,
  type TransactionInput,
} from "../../src/core/transactions/transaction.js";

export function aTransaction(overrides: Partial<TransactionInput> = {}): Transaction {
  return createTransaction({
    id: "transaction-1",
    accountId: "account-person-a-checking",
    categoryId: "category-groceries",
    categoryOrigin: "manual",
    date: "2026-07-15",
    amountCents: -4299,
    description: "Groceries",
    payee: "Market",
    source: "manual",
    status: "booked",
    fixedCost: false,
    note: null,
    ...overrides,
  });
}
