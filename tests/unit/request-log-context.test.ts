import { describe, expect, it } from "vitest";

import { normalizeQueryForLog } from "../../src/adapters/logging/request-log-context.js";

const transactionId = "123e4567-e89b-42d3-a456-426614174000";

const deniedValues = [
  "cookie=session-cookie",
  "Bearer authorization-token",
  "session-hash",
  "oidc-code",
  "oidc-state",
  "oidc-nonce",
  "oidc-token",
  "password-value",
  "secret-value",
  "Date;Amount;Description\\n2026-07-15;42.99;Private payee",
  "Private description",
  "Private payee",
  "Private purpose",
  "Private note",
  "42.99",
  "validation detail",
  "raw thrown error",
];

describe("normalizeQueryForLog", () => {
  it("retains only canonical stable IDs and bounded aggregate integer counts", () => {
    expect(
      normalizeQueryForLog({
        transactionId,
        rowCount: "10000",
        code: deniedValues[4],
        token: deniedValues[7],
        description: deniedValues[11],
        amount: deniedValues[15],
      }),
    ).toEqual({ transactionId, rowCount: "10000" });
    expect(normalizeQueryForLog({ rowCount: "0" })).toEqual({ rowCount: "0" });
  });

  it.each([
    ["month", "2026-07"],
    ["month", deniedValues[8]],
    ["month", ["2026-07", "2026-07"]],
    ["month", ["2026-07", deniedValues[8]]],
    ["transactionId", deniedValues[8]],
    ["transactionId", "transaction-123"],
    ["transactionId", transactionId.toUpperCase()],
    ["transactionId", [transactionId, transactionId]],
    ["transactionId", [transactionId, deniedValues[8]]],
    ["rowCount", deniedValues[8]],
    ["rowCount", "42.99"],
    ["rowCount", "-1"],
    ["rowCount", "10001"],
    ["rowCount", ["2", "2"]],
    ["rowCount", ["2", deniedValues[8]]],
  ])("omits denied %s query value %#", (key, value) => {
    const serialized = JSON.stringify(normalizeQueryForLog({ [key]: value }));

    expect(serialized).toBe("{}");
    for (const deniedValue of deniedValues) {
      expect(serialized).not.toContain(deniedValue);
    }
  });
});
