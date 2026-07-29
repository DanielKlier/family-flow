const secretQueryPattern = /(?:code|secret|token|session|state|password)/i;

export function normalizeQueryForLog(query: unknown): Record<string, string | string[]> {
  if (typeof query !== "object" || query === null) {
    return {};
  }

  const normalized: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value === "string" || isStringArray(value)) {
      normalized[key] = secretQueryPattern.test(key) ? "[redacted]" : value;
    }
  }

  return normalized;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
