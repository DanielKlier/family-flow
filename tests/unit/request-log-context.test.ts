import { describe, expect, it } from "vitest";

import { normalizeQueryForLog } from "../../src/adapters/logging/request-log-context.js";

describe("normalizeQueryForLog", () => {
  it("retains only safe query diagnostics and omits secret and financial fields", () => {
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

    const serialized = JSON.stringify(
      normalizeQueryForLog({
        month: "2026-07",
        transactionId: "transaction-123",
        rowCount: "2",
        code: deniedValues[4],
        state: deniedValues[5],
        nonce: deniedValues[6],
        token: deniedValues[7],
        authorization: deniedValues[1],
        cookie: deniedValues[0],
        sessionHash: deniedValues[2],
        password: deniedValues[8],
        secret: deniedValues[9],
        csv: deniedValues[10],
        description: deniedValues[11],
        payee: deniedValues[12],
        purpose: deniedValues[13],
        note: deniedValues[14],
        amount: deniedValues[15],
        validation: deniedValues[16],
        error: deniedValues[17],
      }),
    );

    expect(serialized).toBe(
      JSON.stringify({ month: "2026-07", transactionId: "transaction-123", rowCount: "2" }),
    );
    for (const deniedValue of deniedValues) {
      expect(serialized).not.toContain(deniedValue);
    }
  });
});
