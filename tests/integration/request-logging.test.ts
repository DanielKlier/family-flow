import { describe, expect, it } from "vitest";

import { buildServer } from "../../src/app/server.js";
import type { RequestLogEntry, RequestLogger } from "../../src/ports/logging/logger.js";

class CapturingLogger implements RequestLogger {
  entries: RequestLogEntry[] = [];

  logRequest(entry: RequestLogEntry): void {
    this.entries.push(entry);
  }
}

describe("request logging", () => {
  it("INT-FF-OBS-001-01 writes exactly one sanitized request-correlated log", async () => {
    const logger = new CapturingLogger();
    const server = buildServer({ logger });

    const response = await server.inject({
      method: "GET",
      url: "/health?token=secret&month=2026-07",
    });

    expect(response.statusCode).toBe(200);
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toMatchObject({
      method: "GET",
      path: "/health",
      query: { month: "2026-07", token: "[redacted]" },
      statusCode: 200,
      outcome: "success",
      user: null,
    });
    expect(logger.entries[0]?.requestId).toBe(response.headers["x-request-id"]);
    expect(logger.entries[0]?.durationMs).toBeGreaterThanOrEqual(0);

    await server.close();
  });

  it("includes authenticated user context in request logs", async () => {
    const logger = new CapturingLogger();
    const server = buildServer({ logger });

    const loginResponse = await server.inject({
      method: "GET",
      url: "/auth/test-login",
    });
    const sessionCookie = loginResponse.cookies.find((cookie) => cookie.name === "ff_session");

    const response = await server.inject({
      method: "GET",
      url: "/",
      cookies: sessionCookie === undefined ? undefined : { ff_session: sessionCookie.value },
    });

    expect(response.statusCode).toBe(200);
    expect(logger.entries.at(-1)).toMatchObject({
      path: "/",
      user: "test-user",
    });

    await server.close();
  });
});
