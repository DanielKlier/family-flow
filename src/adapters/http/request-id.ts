const canonicalUuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function parseCanonicalRequestId(header: string | string[] | undefined): string | null {
  return typeof header === "string" && canonicalUuidV4.test(header) ? header : null;
}
