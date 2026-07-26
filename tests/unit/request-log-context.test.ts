import { describe, expect, it } from "vitest";

import { normalizeQueryForLog } from "../../src/adapters/logging/request-log-context.js";

describe("normalizeQueryForLog", () => {
  it("redacts secret-like query values", () => {
    expect(
      normalizeQueryForLog({
        code: "oidc-code",
        month: "2026-07",
        sessionToken: "session-token",
        state: "oidc-state",
      }),
    ).toEqual({
      code: "[redacted]",
      month: "2026-07",
      sessionToken: "[redacted]",
      state: "[redacted]",
    });
  });
});
