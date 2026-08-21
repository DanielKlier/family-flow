import { type Category, normalizeCategoryName } from "../categories/category.js";
import { compareCodePoints } from "../shared/compare-code-points.js";
import { normalizeCanonicalText } from "../shared/normalize-canonical-text.js";
import type { CategoryOrigin, Transaction } from "../transactions/transaction.js";

export type CategorizationRule = {
  id: string;
  name: string;
  searchText: string;
  categoryId: string;
  accountId: string | null;
  fixedCost: boolean | null;
  internalTransfer: boolean | null;
  priority: number;
  enabled: boolean;
};

export type CategorizationRuleInput = Omit<
  CategorizationRule,
  "accountId" | "fixedCost" | "internalTransfer"
> & {
  accountId?: string | null;
  fixedCost?: boolean | null;
  internalTransfer?: boolean | null;
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
    internalTransfer: input.internalTransfer ?? null,
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

  return [...matches].sort((left, right) => compareCategorizationRules(left, right))[0] ?? null;
}

export type ImportCategorizationDecision = Pick<Category, "id" | "name"> & {
  origin: Extract<CategoryOrigin, "csv_mapped" | "rule" | "fallback">;
  fixedCost: boolean;
  internalTransfer: boolean;
};

export function decideImportCategorization(
  categories: Category[],
  rules: CategorizationRule[],
  candidate: CategorizationCandidate,
  csvCategoryName: string,
): ImportCategorizationDecision {
  const matchedRule = findCategorizationMatch(rules, candidate);
  const actions = {
    fixedCost: matchedRule?.fixedCost ?? false,
    internalTransfer: matchedRule?.internalTransfer ?? false,
  };
  const normalizedCsvName = normalizeCategoryName(csvCategoryName);
  const csvCategory = categories.find(
    (category) => normalizeCategoryName(category.name) === normalizedCsvName,
  );
  if (csvCategory !== undefined && normalizedCsvName !== "") {
    return { ...csvCategory, origin: "csv_mapped", ...actions };
  }
  const ruleCategory = categories.find((category) => category.id === matchedRule?.categoryId);
  if (ruleCategory !== undefined) return { ...ruleCategory, origin: "rule", ...actions };
  const fallback = categories.find((category) => category.id === "category-other");
  if (fallback === undefined) throw new Error("Fallback category is required");
  return { ...fallback, origin: "fallback", ...actions };
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

    if (match === null) return transaction;

    return {
      ...transaction,
      ...categoryUpdate(transaction, match.categoryId),
      fixedCost: match.fixedCost ?? transaction.fixedCost,
      internalTransfer: match.internalTransfer ?? transaction.internalTransfer,
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

export function normalizeCategorizationText(value: string): string {
  return normalizeCanonicalText(value);
}

function normalizeForMatch(value: string): string {
  return normalizeCategorizationText(value);
}

export function compareCategorizationRules(
  left: Pick<CategorizationRule, "id" | "priority">,
  right: Pick<CategorizationRule, "id" | "priority">,
): number {
  return left.priority - right.priority || compareCodePoints(left.id, right.id);
}

function categoryUpdate(
  transaction: Transaction,
  categoryId: string,
): Partial<Pick<Transaction, "categoryId" | "categoryOrigin">> {
  if (
    transaction.categoryOrigin === "manual" ||
    transaction.categoryOrigin === "csv_mapped" ||
    transaction.categoryOrigin === "legacy_preserved"
  ) {
    return {};
  }
  return { categoryId, categoryOrigin: "rule" };
}
