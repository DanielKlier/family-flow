import { request as httpRequest } from "node:http";

import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import type { RequestLogEntry, RequestLogger } from "../../src/ports/logging/logger.js";
import { loginAsTestUserRequest } from "../support/auth.js";
import { listen } from "../support/server.js";

const canonicalRequestId = "123e4567-e89b-42d3-a456-426614174000";
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class CapturingLogger implements RequestLogger {
  entries: RequestLogEntry[] = [];

  logRequest(entry: RequestLogEntry): void {
    this.entries.push(entry);
  }

  reset(): void {
    this.entries = [];
  }
}

test("E2E-FF-OBS-001-01 preserves one canonical UUIDv4 across the response and final request log", async ({
  request,
}) => {
  const logger = new CapturingLogger();
  const server = buildServer({ logger });

  try {
    const baseUrl = await listen(server);
    logger.reset();
    const response = await request.get(`${baseUrl}/health`, {
      headers: { "X-Request-Id": canonicalRequestId },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()["x-request-id"]).toBe(canonicalRequestId);
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toMatchObject({
      requestId: canonicalRequestId,
      path: "/health",
      statusCode: 200,
      outcome: "success",
    });
  } finally {
    await server.close();
  }
});

test("E2E-FF-OBS-001-02 regenerates unsafe request IDs on every lifecycle path and renders error correlation IDs", async ({
  request,
}) => {
  const logger = new CapturingLogger();
  const server = buildServer({ logger });
  server.get("/__test__/throw", async () => {
    throw new Error("test-only failure");
  });

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);

    const cases = [
      {
        name: "success",
        errorPage: false,
        send: (requestId: string) =>
          request.get(`${baseUrl}/health`, { headers: { "X-Request-Id": requestId } }),
      },
      {
        name: "redirect",
        errorPage: false,
        send: (requestId: string) =>
          request.get(`${baseUrl}/transactions`, {
            headers: { "X-Request-Id": requestId },
            maxRedirects: 0,
          }),
      },
      {
        name: "not found",
        errorPage: true,
        send: (requestId: string) =>
          request.get(`${baseUrl}/transactions/missing/edit`, {
            headers: { "X-Request-Id": requestId },
          }),
      },
      {
        name: "validation",
        errorPage: true,
        send: (requestId: string) =>
          request.post(`${baseUrl}/transactions`, {
            headers: { "X-Request-Id": requestId },
            form: {
              accountId: "account-person-a-checking",
              categoryId: "category-groceries",
              date: "15.07.2026",
              description: "Invalid request-ID fixture",
              amount: "invalid",
              status: "booked",
            },
          }),
      },
      {
        name: "auth failure",
        errorPage: true,
        send: (requestId: string) =>
          request.post(`${baseUrl}/auth/logout`, {
            headers: {
              "X-Request-Id": requestId,
              Origin: "http://127.0.0.1:3000",
              Cookie: "ff_session=unknown-session",
            },
          }),
      },
      {
        name: "unexpected error",
        errorPage: true,
        send: (requestId: string) =>
          request.get(`${baseUrl}/__test__/throw`, { headers: { "X-Request-Id": requestId } }),
      },
    ];

    for (const suppliedRequestId of ["", "not-a-uuid", canonicalRequestId.toUpperCase()]) {
      for (const scenario of cases) {
        logger.reset();
        const response = await scenario.send(suppliedRequestId);
        const responseRequestId = response.headers()["x-request-id"];

        expect(responseRequestId, `${scenario.name}: ${suppliedRequestId || "missing"}`).toMatch(
          uuidV4,
        );
        expect(responseRequestId).not.toBe(suppliedRequestId);
        expect(logger.entries).toHaveLength(1);
        expect(logger.entries[0]?.requestId).toBe(responseRequestId);

        if (scenario.errorPage) {
          expect(await response.text()).toContain(responseRequestId);
        }
      }
    }

    logger.reset();
    const duplicateResponse = await sendDuplicateRequestId(baseUrl);
    expect(duplicateResponse.requestId).toMatch(uuidV4);
    expect(duplicateResponse.requestId).not.toBe(canonicalRequestId);
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]?.requestId).toBe(duplicateResponse.requestId);
  } finally {
    await server.close();
  }
});

async function sendDuplicateRequestId(baseUrl: string): Promise<{ requestId: string | undefined }> {
  const url = new URL("/health", baseUrl);

  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: [
        "Host",
        url.host,
        "X-Request-Id",
        canonicalRequestId,
        "X-Request-Id",
        canonicalRequestId,
      ],
    });
    request.once("response", (response) => {
      response.resume();
      response.once("end", () => {
        const requestId = response.headers["x-request-id"];
        resolve({ requestId: typeof requestId === "string" ? requestId : undefined });
      });
    });
    request.once("error", reject);
    request.end();
  });
}
