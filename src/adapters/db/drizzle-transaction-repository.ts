import { and, desc, eq, gte, lt } from "drizzle-orm";

import {
  createTransaction,
  type Transaction,
  type TransactionSource,
  type TransactionStatus,
} from "../../core/transactions/transaction.js";
import type {
  TransactionFilters,
  TransactionRepository,
} from "../../ports/repositories/transaction-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { accounts, transactions } from "./schema.js";

export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async list(filters: TransactionFilters): Promise<Transaction[]> {
    const conditions = buildConditions(filters);
    const rows = await this.db
      .select({ transaction: transactions })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.date), transactions.description);

    return rows.map((row) => mapTransaction(row.transaction));
  }

  async get(id: string): Promise<Transaction | null> {
    const rows = await this.db.select().from(transactions).where(eq(transactions.id, id)).limit(1);

    return rows[0] === undefined ? null : mapTransaction(rows[0]);
  }

  async save(transaction: Transaction): Promise<void> {
    await this.db
      .insert(transactions)
      .values(transaction)
      .onConflictDoUpdate({
        target: transactions.id,
        set: {
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          date: transaction.date,
          amountCents: transaction.amountCents,
          description: transaction.description,
          payee: transaction.payee,
          purpose: transaction.purpose,
          source: transaction.source,
          status: transaction.status,
          fixedCost: transaction.fixedCost,
          internalTransfer: transaction.internalTransfer,
          note: transaction.note,
          importHash: transaction.importHash,
        },
      });
  }

  async setInternalTransfer(id: string, internalTransfer: boolean): Promise<boolean> {
    const updated = await this.db
      .update(transactions)
      .set({ internalTransfer })
      .where(eq(transactions.id, id))
      .returning({ id: transactions.id });

    return updated.length === 1;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(transactions).where(eq(transactions.id, id));
  }
}

function buildConditions(filters: TransactionFilters) {
  const conditions = [];
  if (filters.month !== undefined) {
    conditions.push(gte(transactions.date, `${filters.month}-01`));
    conditions.push(lt(transactions.date, nextMonth(filters.month)));
  }
  if (filters.accountId !== undefined) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.ownerContext !== undefined) {
    conditions.push(eq(accounts.ownerContext, filters.ownerContext));
  }
  if (filters.categoryId !== undefined) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.status !== undefined) {
    conditions.push(eq(transactions.status, filters.status));
  }
  if (filters.fixedCost !== undefined) {
    conditions.push(eq(transactions.fixedCost, filters.fixedCost));
  }
  if (filters.internalTransfer !== undefined) {
    conditions.push(eq(transactions.internalTransfer, filters.internalTransfer));
  }

  return conditions;
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (year === undefined || monthNumber === undefined) {
    throw new Error("Month must use YYYY-MM");
  }
  const date = new Date(Date.UTC(year, monthNumber, 1));

  return date.toISOString().slice(0, 10);
}

function mapTransaction(row: typeof transactions.$inferSelect): Transaction {
  return createTransaction({
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    date: row.date,
    amountCents: row.amountCents,
    description: row.description,
    payee: row.payee,
    purpose: row.purpose,
    source: parseTransactionSource(row.source),
    status: parseTransactionStatus(row.status),
    fixedCost: row.fixedCost,
    internalTransfer: row.internalTransfer,
    note: row.note,
    importHash: row.importHash,
  });
}

function parseTransactionSource(value: string): TransactionSource {
  if (value === "manual" || value === "csv") {
    return value;
  }

  throw new Error("Transaction source is invalid");
}

function parseTransactionStatus(value: string): TransactionStatus {
  if (value === "booked" || value === "planned") {
    return value;
  }

  throw new Error("Transaction status is invalid");
}
