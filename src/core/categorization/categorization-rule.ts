export type CategorizationRule = {
  id: string;
  name: string;
  searchText: string;
  categoryId: string;
  accountId: string | null;
  priority: number;
  enabled: boolean;
};

export type CategorizationRuleInput = Omit<CategorizationRule, "accountId"> & {
  accountId?: string | null;
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
    priority: input.priority,
    enabled: input.enabled,
  };
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
