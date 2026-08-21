import type { Transaction } from "../transactions/transaction.js";
import { applyCategorizationRules, type CategorizationRule } from "./categorization-rule.js";

export type CategorizationTransactionPersistence = {
  list(filters: Record<string, never>): Promise<Transaction[]>;
  save(transaction: Transaction): Promise<void>;
};

export type ReapplicationResult = { changed: number; unchanged: number };

export async function reapplyCategorizationRules(
  rules: CategorizationRule[],
  persistence: CategorizationTransactionPersistence,
): Promise<ReapplicationResult> {
  const transactions = (await persistence.list({})).sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  let changed = 0;

  for (const transaction of transactions) {
    const [updated] = applyCategorizationRules(rules, [transaction]);
    if (updated === undefined || !hasRelevantChange(transaction, updated)) continue;
    await persistence.save(updated);
    changed += 1;
  }

  return { changed, unchanged: transactions.length - changed };
}

function hasRelevantChange(before: Transaction, after: Transaction): boolean {
  return (
    before.categoryId !== after.categoryId ||
    before.categoryOrigin !== after.categoryOrigin ||
    before.fixedCost !== after.fixedCost ||
    before.internalTransfer !== after.internalTransfer
  );
}
