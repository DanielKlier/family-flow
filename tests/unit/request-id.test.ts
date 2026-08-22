import { describe, expect, it } from "vitest";

import { parseCanonicalRequestId } from "../../src/adapters/http/request-id.js";

const canonicalRequestId = "123e4567-e89b-42d3-a456-426614174000";

describe("parseCanonicalRequestId", () => {
  it("accepts exactly one lowercase canonical UUIDv4", () => {
    expect(parseCanonicalRequestId(canonicalRequestId)).toBe(canonicalRequestId);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["malformed", "request-123"],
    ["uppercase", canonicalRequestId.toUpperCase()],
    ["noncanonical UUIDv4", "123e4567-e89b-42d3-a456-426614174000 "],
    ["repeated header values", [canonicalRequestId, canonicalRequestId]],
  ])("rejects %s values", (_name, header) => {
    expect(parseCanonicalRequestId(header)).toBeNull();
  });
});
