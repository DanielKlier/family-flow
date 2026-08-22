const canonicalTransactionId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const aggregateCount = /^(?:0|[1-9][0-9]{0,4})$/;
const maximumAggregateCount = 10_000;

export function normalizeQueryForLog(query: unknown): Record<string, string | string[]> {
  if (typeof query !== "object" || query === null) return {};

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== "string") continue;

    if (key === "transactionId" && canonicalTransactionId.test(value)) {
      normalized.transactionId = value;
    }
    if (key === "rowCount" && isBoundedAggregateCount(value)) {
      normalized.rowCount = value;
    }
  }

  return normalized;
}

function isBoundedAggregateCount(value: string): boolean {
  return aggregateCount.test(value) && Number(value) <= maximumAggregateCount;
}
