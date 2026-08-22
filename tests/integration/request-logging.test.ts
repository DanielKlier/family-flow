import { afterEach, describe, expect, it, vi } from "vitest";

import { buildServer } from "../../src/app/server.js";
import { HumanReadableRequestLogger } from "../../src/adapters/logging/human-readable-logger.js";
import type { RequestLogEntry, RequestLogger } from "../../src/ports/logging/logger.js";

class CapturingLogger implements RequestLogger {
  entries: RequestLogEntry[] = [];

  logRequest(entry: RequestLogEntry): void {
    this.entries.push(entry);
  }

  reset(): void {
    this.entries = [];
  }
}

const requestIds = {
  success: "123e4567-e89b-42d3-a456-426614174001",
  redirect: "123e4567-e89b-42d3-a456-426614174002",
  notFound: "123e4567-e89b-42d3-a456-426614174003",
  validation: "123e4567-e89b-42d3-a456-426614174004",
  auth: "123e4567-e89b-42d3-a456-426614174005",
  exception: "123e4567-e89b-42d3-a456-426614174006",
};

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request logging", () => {
  it("INT-FF-OBS-002-01 writes one final, request-correlated success and redirect entry", async () => {
    const logger = new CapturingLogger();
    const server = buildServer({ logger });

    try {
      const success = await server.inject({
        method: "GET",
        url: "/health?month=2026-07",
        headers: { "x-request-id": requestIds.success },
      });
      expect(success.statusCode).toBe(200);
      expectFinalEntry(logger, {
        requestId: requestIds.success,
        path: "/health",
        statusCode: 200,
        outcome: "success",
        user: null,
      });

      logger.reset();
      const redirect = await server.inject({
        method: "GET",
        url: "/transactions",
        headers: { "x-request-id": requestIds.redirect },
      });
      expect(redirect.statusCode).toBe(302);
      expectFinalEntry(logger, {
        requestId: requestIds.redirect,
        path: "/transactions",
        statusCode: 302,
        outcome: "success",
        user: null,
      });
    } finally {
      await server.close();
    }
  });

  it("INT-FF-OBS-003-01 writes one final safe entry for authenticated 404 and validation responses", async () => {
    const logger = new CapturingLogger();
    const server = buildServer({ logger });

    try {
      const session = await testSession(server);
      logger.reset();
      const missing = await server.inject({
        method: "GET",
        url: "/transactions/missing/edit",
        cookies: { ff_session: session },
        headers: { "x-request-id": requestIds.notFound },
      });
      expect(missing.statusCode).toBe(404);
      expectFinalEntry(logger, {
        requestId: requestIds.notFound,
        path: "/transactions/missing/edit",
        statusCode: 404,
        outcome: "error",
        user: "test-user",
      });

      logger.reset();
      const validation = await server.inject({
        method: "POST",
        url: "/transactions",
        cookies: { ff_session: session },
        headers: { "x-request-id": requestIds.validation },
        payload: {
          accountId: "account-person-a-checking",
          categoryId: "category-groceries",
          date: "15.07.2026",
          description: deniedValues[11],
          amount: "invalid",
          status: "booked",
        },
      });
      expect(validation.statusCode).toBe(400);
      expectFinalEntry(logger, {
        requestId: requestIds.validation,
        path: "/transactions",
        statusCode: 400,
        outcome: "error",
        user: "test-user",
      });
    } finally {
      await server.close();
    }
  });

  it("INT-FF-OBS-004-01 writes one final safe entry for an invalid-session logout", async () => {
    const logger = new CapturingLogger();
    const server = buildServer({ logger });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/auth/logout",
        cookies: { ff_session: "session-hash" },
        headers: { origin: "http://127.0.0.1:3000", "x-request-id": requestIds.auth },
      });

      expect(response.statusCode).toBe(401);
      expectFinalEntry(logger, {
        requestId: requestIds.auth,
        path: "/auth/logout",
        statusCode: 401,
        outcome: "error",
        user: null,
      });
    } finally {
      await server.close();
    }
  });

  it("INT-FF-OBS-001-01 INT-FF-OBS-005-01 INT-FF-CSV-011-01 excludes request secrets and raw errors from serialized entries and one-line stdout", async () => {
    const logger = new CapturingLogger();
    const server = buildServer({ logger });
    server.get("/__test__/throw", async () => {
      throw new Error(`raw thrown error: ${deniedValues.join(" | ")}`);
    });

    try {
      const session = await testSession(server);
      logger.reset();
      const response = await server.inject({
        method: "GET",
        url: `/__test__/throw?month=2026-07&transactionId=transaction-123&rowCount=2&token=${encodeURIComponent(deniedValues[7])}&code=${encodeURIComponent(deniedValues[4])}&state=${encodeURIComponent(deniedValues[5])}&description=${encodeURIComponent(deniedValues[11])}&payee=${encodeURIComponent(deniedValues[12])}&purpose=${encodeURIComponent(deniedValues[13])}&note=${encodeURIComponent(deniedValues[14])}&amount=${deniedValues[15]}`,
        cookies: { ff_session: session },
        headers: {
          authorization: deniedValues[1],
          cookie: deniedValues[0],
          "x-request-id": requestIds.exception,
        },
      });

      expect(response.statusCode).toBe(500);
      expectFinalEntry(logger, {
        requestId: requestIds.exception,
        path: "/__test__/throw",
        statusCode: 500,
        outcome: "error",
        user: "test-user",
      });
      const entry = logger.entries[0];
      expect(entry).toMatchObject({
        error: { type: "unexpected-error", message: "Unexpected server error" },
        query: { month: "2026-07", transactionId: "transaction-123", rowCount: "2" },
      });
      assertDeniedValuesAbsent(JSON.stringify(entry));

      const stdout = vi.spyOn(console, "log").mockImplementation(() => undefined);
      new HumanReadableRequestLogger().logRequest(entry as RequestLogEntry);
      expect(stdout).toHaveBeenCalledTimes(1);
      const line = String(stdout.mock.calls[0]?.[0]);
      expect(line).toContain(`request_id=${requestIds.exception}`);
      expect(line).toContain("outcome=error");
      expect(line).not.toContain("\n");
      assertDeniedValuesAbsent(line);
    } finally {
      await server.close();
    }
  });
});

function expectFinalEntry(
  logger: CapturingLogger,
  expected: Pick<RequestLogEntry, "requestId" | "path" | "statusCode" | "outcome" | "user">,
): void {
  expect(logger.entries).toHaveLength(1);
  expect(logger.entries[0]).toMatchObject(expected);
  expect(logger.entries[0]?.timestamp).toEqual(expect.any(String));
  expect(logger.entries[0]?.durationMs).toBeGreaterThanOrEqual(0);
  if (expected.outcome === "error") {
    expect(logger.entries[0]).toMatchObject({
      error: { type: expect.any(String), message: expect.any(String) },
    });
  }
}

async function testSession(server: ReturnType<typeof buildServer>): Promise<string> {
  const login = await server.inject({ method: "GET", url: "/auth/test-login" });
  const session = login.cookies.find((cookie) => cookie.name === "ff_session")?.value;
  if (session === undefined) throw new Error("Expected test login to issue a session cookie");
  return session;
}

function assertDeniedValuesAbsent(output: string): void {
  for (const deniedValue of deniedValues) {
    expect(output).not.toContain(deniedValue);
  }
}
