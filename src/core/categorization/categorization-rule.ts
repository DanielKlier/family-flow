import type { Transaction } from "../transactions/transaction.js";

export type CategorizationRule = {
  id: string;
  name: string;
  searchText: string;
  categoryId: string;
  accountId: string | null;
  fixedCost: boolean | null;
  priority: number;
  enabled: boolean;
};

export type CategorizationRuleInput = Omit<CategorizationRule, "accountId" | "fixedCost"> & {
  accountId?: string | null;
  fixedCost?: boolean | null;
};

export type CategorizationCandidate = {
  accountId: string;
  description: string;
  payee: string | null;
  purpose?: string | null;
};

export function createCategorizationRule(input: CategorizationRuleInput): CategorizationRule {
  const id = requireTrimmed(input.id, "Categorization rule id is required");
  const name = requireTrimmed(input.name, "Categorization rule name is required");
  const searchText = requireTrimmed(
    input.searchText,
    "Categorization rule search text is required",
  );
  const categoryId = requireTrimmed(input.categoryId, "Categorization rule category is required");
  const accountId = normalizeOptionalText(input.accountId ?? null);

  if (!Number.isInteger(input.priority) || input.priority < 0) {
    throw new Error("Categorization rule priority must be a non-negative integer");
  }

  return {
    id,
    name,
    searchText,
    categoryId,
    accountId,
    fixedCost: input.fixedCost ?? null,
    priority: input.priority,
    enabled: input.enabled,
  };
}

export function findCategorizationMatch(
  rules: CategorizationRule[],
  candidate: CategorizationCandidate,
): CategorizationRule | null {
  const normalizedDescription = normalizeForMatch(candidate.description);
  const normalizedPayee = normalizeForMatch(candidate.payee ?? "");
  const normalizedPurpose = normalizeForMatch(candidate.purpose ?? "");

  const matches = rules.filter((rule) => {
    if (!rule.enabled) {
      return false;
    }

    if (rule.accountId !== null && rule.accountId !== candidate.accountId) {
      return false;
    }

    const searchText = normalizeForMatch(rule.searchText);
    return (
      normalizedDescription.includes(searchText) ||
      normalizedPayee.includes(searchText) ||
      normalizedPurpose.includes(searchText)
    );
  });

  return [...matches].sort((left, right) => left.priority - right.priority)[0] ?? null;
}

export function applyCategorizationRules(
  rules: CategorizationRule[],
  transactions: Transaction[],
): Transaction[] {
  return transactions.map((transaction) => {
    const match = findCategorizationMatch(rules, {
      accountId: transaction.accountId,
      description: transaction.description,
      payee: transaction.payee,
      purpose: transaction.purpose,
    });

    return match === null
      ? transaction
      : {
          ...transaction,
          categoryId: match.categoryId,
          fixedCost: match.fixedCost ?? transaction.fixedCost,
        };
  });
}

function requireTrimmed(value: string, message: string): string {
  const trimmed = value.trim();

  if (trimmed === "") {
    throw new Error(message);
  }

  return trimmed;
}

function normalizeOptionalText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeForMatch(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}
