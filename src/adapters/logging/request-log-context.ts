const secretQueryPattern = /(?:code|secret|token|session|state|password)/i;

export function normalizeQueryForLog(
  query: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, secretQueryPattern.test(key) ? "[redacted]" : value]),
  ) as Record<string, string | string[]>;
}
