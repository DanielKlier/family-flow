const safeQueryKeys = new Set(["month", "transactionId", "rowCount"]);

export function normalizeQueryForLog(query: unknown): Record<string, string | string[]> {
  if (typeof query !== "object" || query === null) {
    return {};
  }

  const normalized: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!safeQueryKeys.has(key)) {
      continue;
    }
    if (typeof value === "string" || isStringArray(value)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
