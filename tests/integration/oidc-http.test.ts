import { type createPrivateKey, generateKeyPairSync, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { loadConfig } from "../../src/app/config.js";
import { buildServer } from "../../src/app/server.js";
import type { RequestLogEntry, RequestLogger } from "../../src/ports/logging/logger.js";

class CapturingLogger implements RequestLogger {
  readonly entries: RequestLogEntry[] = [];

  logRequest(entry: RequestLogEntry): void {
    this.entries.push(entry);
  }
}

describe("OIDC HTTP adapter", () => {
  it("INT-FF-AUTH-008-01 retains the OIDC subject after an owner-label edit", async () => {
    const fixture = createOidcServerFixture();

    try {
      const headers = await fixture.login("fixture-owner-a");
      const update = await fixture.server.inject({
        method: "POST",
        url: "/admin/master-data/owner-contexts/person_a",
        headers,
        payload: { label: "Reporting name" },
      });
      const protectedRequest = await fixture.server.inject({
        method: "GET",
        url: "/admin/master-data",
        headers,
      });

      expect(update.statusCode).toBe(302);
      expect(protectedRequest.statusCode).toBe(200);
      expect(
        fixture.logger.entries.filter((entry) => entry.path === "/admin/master-data"),
      ).toContainEqual(expect.objectContaining({ user: "fixture-owner-a", statusCode: 200 }));
      expect(
        fixture.logger.entries.find(
          (entry) => entry.path === "/admin/master-data/owner-contexts/person_a",
        )?.user,
      ).toBe("fixture-owner-a");
      expect(fixture.logger.entries.map((entry) => entry.user)).not.toContain("Reporting name");
    } finally {
      await fixture.close();
    }
  });

  it("INT-FF-SCP-003-01 gives both OIDC identities equal owner-label access without reassigning accounts", async () => {
    const fixture = createOidcServerFixture();

    try {
      const accountsBefore = await fixture.repositories.accounts.list();
      const firstHeaders = await fixture.login("fixture-owner-a");
      const secondHeaders = await fixture.login("fixture-owner-b");

      for (const headers of [firstHeaders, secondHeaders]) {
        expect(
          (await fixture.server.inject({ method: "GET", url: "/admin/master-data", headers }))
            .statusCode,
        ).toBe(200);
        for (const ownerContext of ["person_a", "person_b", "shared"] as const) {
          expect(
            (
              await fixture.server.inject({
                method: "POST",
                url: `/admin/master-data/owner-contexts/${ownerContext}`,
                headers,
                payload: { label: `${ownerContext} label` },
              })
            ).statusCode,
          ).toBe(302);
        }
      }

      await expect(fixture.repositories.accounts.list()).resolves.toEqual(accountsBefore);
      expect(fixture.logger.entries.map((entry) => entry.user)).toContain("fixture-owner-a");
      expect(fixture.logger.entries.map((entry) => entry.user)).toContain("fixture-owner-b");
    } finally {
      await fixture.close();
    }
  });

  it("INT-FF-AUTH-002-03 rejects development authentication configuration in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "3000",
        BASE_URL: "https://finances.home.arpa",
        DATABASE_URL: "postgres://family_flow:family_flow@postgres:5432/family_flow",
        AUTH_MODE: "oidc",
        OIDC_ISSUER_URL: "http://127.0.0.1:5556/dex",
        OIDC_CLIENT_ID: "family-flow-dev",
        OIDC_CLIENT_SECRET: "family-flow-dev-secret",
      }),
    ).toThrow();
  });

  it("INT-FF-AUTH-002-01 INT-FF-AUTH-002-02 covers valid, malformed, failed, expired, and reused callbacks without logging secrets", async () => {
    const issuer = "https://issuer.example.invalid/family-flow";
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" });
    const idToken = signIdToken(privateKey, {
      iss: issuer,
      aud: "family-flow-client",
      exp: 1_900_000_000,
      sub: "oidc-subject",
      name: "OIDC User",
      email: "oidc@example.invalid",
      nonce: "nonce-from-server-transaction",
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url === `${issuer}/.well-known/openid-configuration`) {
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/jwks`,
        });
      }
      if (url === `${issuer}/token` && init?.method === "POST") {
        if (String(init.body).includes("code=invalid-code")) {
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        }
        return Response.json({ id_token: idToken });
      }
      if (url === `${issuer}/jwks`)
        return Response.json({ keys: [{ ...jwk, kid: "fixture-key" }] });
      throw new Error(`Unexpected OIDC fixture request: ${url}`);
    };

    const logger = new CapturingLogger();
    let now = new Date("2025-01-01T00:00:00.000Z");
    const oidcTokens = sequence([
      "s".repeat(43),
      "nonce-from-server-transaction",
      "i".repeat(43),
      "nonce-for-invalid-code",
      "e".repeat(43),
      "nonce-for-expired-transaction",
    ]);
    const server = buildServer({
      logger,
      clock: { now: () => new Date(now) },
      oidcTokens: { generate: oidcTokens },
      auth: {
        mode: "oidc",
        baseUrl: "https://finances.home.arpa",
        oidc: { issuerUrl: issuer, clientId: "family-flow-client", clientSecret: "client-secret" },
      },
    });

    try {
      const malformed = await server.inject({
        method: "GET",
        url: "/auth/callback?code=wrong-callback-without-state",
      });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.headers["x-request-id"]).toBeDefined();

      const login = await server.inject({
        method: "GET",
        url: "/auth/login?returnTo=%2Ftransactions%3Fmonth%3D2025-01",
      });
      const authorizationUrl = new URL(login.headers.location ?? "");
      const state = authorizationUrl.searchParams.get("state");

      expect(login.statusCode).toBe(302);
      expect(state).toMatch(/^[A-Za-z0-9_-]{32,}$/);
      expect(authorizationUrl.searchParams.get("nonce")).toBe("nonce-from-server-transaction");
      expect(login.headers["set-cookie"]).toBeUndefined();

      const callback = await server.inject({
        method: "GET",
        url: `/auth/callback?code=authorization-code&state=${encodeURIComponent(state ?? "")}`,
      });

      expect(callback.statusCode).toBe(302);
      expect(callback.headers.location).toBe("/transactions?month=2025-01");
      expect(callback.cookies.find((cookie) => cookie.name === "ff_session")?.value).toMatch(
        /^[A-Za-z0-9_-]{43}$/,
      );
      expect(callback.headers["x-request-id"]).toBeDefined();
      expect(logger.entries.filter((entry) => entry.path === "/auth/callback")).toContainEqual(
        expect.objectContaining({ requestId: callback.headers["x-request-id"], statusCode: 302 }),
      );
      expect(JSON.stringify(logger.entries)).not.toContain("authorization-code");
      expect(JSON.stringify(logger.entries)).not.toContain(idToken);

      const reused = await server.inject({
        method: "GET",
        url: `/auth/callback?code=leaked-reuse-code&state=${encodeURIComponent(state ?? "")}`,
      });
      expect(reused.statusCode).toBe(400);
      expect(reused.headers["x-request-id"]).toBeDefined();
      expect(JSON.stringify(logger.entries)).not.toContain("leaked-reuse-code");

      const invalidCodeLogin = await server.inject({ method: "GET", url: "/auth/login" });
      const invalidCodeState = new URL(invalidCodeLogin.headers.location ?? "").searchParams.get(
        "state",
      );
      const invalidCode = await server.inject({
        method: "GET",
        url: `/auth/callback?code=invalid-code&state=${encodeURIComponent(invalidCodeState ?? "")}`,
      });
      expect(invalidCode.statusCode).toBe(400);
      expect(invalidCode.headers["x-request-id"]).toBeDefined();
      expect(JSON.stringify(logger.entries)).not.toContain("invalid-code");

      const expiredLogin = await server.inject({ method: "GET", url: "/auth/login" });
      const expiredState = new URL(expiredLogin.headers.location ?? "").searchParams.get("state");
      now = new Date("2025-01-01T00:10:00.001Z");
      const expired = await server.inject({
        method: "GET",
        url: `/auth/callback?code=expired-code&state=${encodeURIComponent(expiredState ?? "")}`,
      });
      expect(expired.statusCode).toBe(400);
      expect(expired.headers["x-request-id"]).toBeDefined();
      expect(JSON.stringify(logger.entries)).not.toContain("expired-code");
      expect(JSON.stringify(logger.entries)).not.toContain("wrong-callback-without-state");
      expect(logger.entries.filter((entry) => entry.path === "/auth/callback")).toHaveLength(5);
    } finally {
      globalThis.fetch = originalFetch;
      await server.close();
    }
  });
});

function createOidcServerFixture() {
  const issuer = "https://issuer.example.invalid/family-flow";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === `${issuer}/.well-known/openid-configuration`) {
      return Response.json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/jwks`,
      });
    }
    if (url === `${issuer}/token` && init?.method === "POST") {
      const [sub, nonce] = new URLSearchParams(String(init.body)).get("code")?.split(":") ?? [];
      if (sub === undefined || nonce === undefined)
        throw new Error("OIDC fixture code is malformed");
      return Response.json({
        id_token: signIdToken(privateKey, {
          iss: issuer,
          aud: "family-flow-client",
          exp: 1_900_000_000,
          sub,
          name: `${sub} name`,
          email: `${sub}@example.invalid`,
          nonce,
        }),
      });
    }
    if (url === `${issuer}/jwks`) {
      return Response.json({ keys: [{ ...jwk, kid: "fixture-key" }] });
    }
    throw new Error(`Unexpected OIDC fixture request: ${url}`);
  };

  const logger = new CapturingLogger();
  const repositories = createSeededInMemoryRepositories(createGermanLocalization());
  const server = buildServer({
    logger,
    repositories,
    oidcTokens: {
      generate: sequence(["a".repeat(43), "b".repeat(43), "c".repeat(43), "d".repeat(43)]),
    },
    auth: {
      mode: "oidc",
      baseUrl: "https://family-flow.example.invalid",
      oidc: { issuerUrl: issuer, clientId: "family-flow-client", clientSecret: "client-secret" },
    },
  });

  return {
    logger,
    repositories,
    server,
    async login(sub: string) {
      const login = await server.inject({ method: "GET", url: "/auth/login" });
      if (login.statusCode !== 302 || login.headers.location === undefined) {
        throw new Error(`OIDC fixture login failed: ${login.statusCode}`);
      }
      const authorizationUrl = new URL(login.headers.location);
      const state = authorizationUrl.searchParams.get("state");
      const nonce = authorizationUrl.searchParams.get("nonce");
      const callback = await server.inject({
        method: "GET",
        url: `/auth/callback?code=${encodeURIComponent(`${sub}:${nonce ?? ""}`)}&state=${encodeURIComponent(state ?? "")}`,
      });
      const session = callback.cookies.find(({ name }) => name === "ff_session");
      if (callback.statusCode !== 302 || session === undefined) {
        throw new Error("OIDC fixture login must establish a session");
      }
      return { cookie: `ff_session=${session.value}` };
    },
    async close() {
      globalThis.fetch = originalFetch;
      await server.close();
    },
  };
}

function sequence(values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? "unexpected-token";
}

function signIdToken(
  privateKey: ReturnType<typeof createPrivateKey>,
  claims: Record<string, unknown>,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "fixture-key", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString(
    "base64url",
  );
  return `${header}.${payload}.${signature}`;
}
