import { generateKeyPairSync, sign } from "node:crypto";

import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserRequest } from "../support/auth.js";
import { listen } from "../support/server.js";

test("E2E-FF-AUTH-001-01: every protected route, including logout, redirects unauthenticated callers to login", async ({
  request,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    const protectedPaths = [
      "/",
      "/admin/master-data",
      "/transactions",
      "/income",
      "/imports/csv",
      "/categorization-rules",
      "/auth/logout",
    ];

    for (const path of protectedPaths) {
      const response = await request.get(`${baseUrl}${path}`, { maxRedirects: 0 });

      expect(response.status(), path).toBe(302);
      expect(response.headers().location, path).toBe(
        `/auth/login?returnTo=${encodeURIComponent(path)}`,
      );
    }
  } finally {
    await server.close();
  }
});

test("E2E-FF-AUTH-001-02: public endpoints remain public and test login is not public in OIDC mode", async ({
  request,
}) => {
  const testServer = buildServer();
  const oidcServer = buildServer({
    auth: {
      mode: "oidc",
      baseUrl: "http://127.0.0.1:3000",
      oidc: {
        issuerUrl: "https://issuer.example.invalid",
        clientId: "family-flow",
        clientSecret: "not-a-secret",
      },
    },
  });

  try {
    const [testBaseUrl, oidcBaseUrl] = await Promise.all([listen(testServer), listen(oidcServer)]);

    for (const path of ["/health", "/auth/login", "/auth/callback", "/assets/app.css"]) {
      const response = await request.get(`${testBaseUrl}${path}`, { maxRedirects: 0 });
      expect(response.status(), path).not.toBe(302);
    }

    expect(
      (await request.get(`${testBaseUrl}/auth/test-login`, { maxRedirects: 0 })).status(),
    ).toBe(302);
    const oidcTestLogin = await request.get(`${oidcBaseUrl}/auth/test-login`, {
      maxRedirects: 0,
    });
    expect(oidcTestLogin.status()).toBe(302);
    expect(oidcTestLogin.headers().location).toBe("/auth/login?returnTo=%2Fauth%2Ftest-login");
  } finally {
    await Promise.all([testServer.close(), oidcServer.close()]);
  }
});

test("E2E-FF-AUTH-001-03: only an authenticated same-origin POST logout revokes its session", async ({
  request,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    const login = await request.get(`${baseUrl}/auth/test-login`, { maxRedirects: 0 });
    const copiedCookie = login.headers()["set-cookie"]?.split(";", 1)[0] ?? "";
    const origin = "http://127.0.0.1:3000";

    expect((await fetch(`${baseUrl}/auth/logout`, { redirect: "manual" })).status).toBe(302);
    expect(
      (
        await fetch(`${baseUrl}/auth/logout`, {
          headers: { Cookie: copiedCookie },
          redirect: "manual",
        })
      ).status,
    ).toBe(404);

    for (const headers of [{}, { Origin: "https://attacker.example.invalid" }]) {
      const rejected = await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: { Cookie: copiedCookie, ...headers },
        redirect: "manual",
      });
      expect(rejected.status).toBe(403);
      expect(
        (
          await fetch(`${baseUrl}/transactions`, {
            headers: { Cookie: copiedCookie },
            redirect: "manual",
          })
        ).status,
      ).toBe(200);
    }

    expect(
      (
        await fetch(`${baseUrl}/auth/logout`, {
          method: "POST",
          headers: { Origin: origin },
          redirect: "manual",
        })
      ).status,
    ).toBe(401);

    expect(
      (
        await fetch(`${baseUrl}/auth/logout`, {
          method: "POST",
          headers: { Cookie: copiedCookie, Origin: origin },
          redirect: "manual",
        })
      ).status,
    ).toBe(302);
    expect(
      (
        await fetch(`${baseUrl}/transactions`, {
          headers: { Cookie: copiedCookie },
          redirect: "manual",
        })
      ).status,
    ).toBe(302);
  } finally {
    await server.close();
  }
});

test("E2E-FF-AUTH-002-01: a valid signed ID token correlated by server state and nonce creates a session and returns safely", async ({
  request,
}) => {
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
    if (url === `${issuer}/jwks`) return Response.json({ keys: [{ ...jwk, kid: "e2e-key" }] });
    if (url === `${issuer}/token` && init?.method === "POST") {
      return Response.json({
        id_token: signedIdToken(privateKey, issuer, "nonce-from-authorization-request"),
      });
    }
    throw new Error(`Unexpected OIDC fixture request: ${url}`);
  };
  const oidcTokens = sequence(["s".repeat(43), "nonce-from-authorization-request"]);
  const server = buildServer({
    auth: {
      mode: "oidc",
      baseUrl: "http://127.0.0.1:3000",
      oidc: { issuerUrl: issuer, clientId: "family-flow-client", clientSecret: "client-secret" },
    },
    oidcTokens: { generate: oidcTokens },
  });

  try {
    const baseUrl = await listen(server);
    const login = await request.get(
      `${baseUrl}/auth/login?returnTo=%2Ftransactions%3Fmonth%3D2025-01`,
      {
        maxRedirects: 0,
      },
    );
    const authorizationUrl = new URL(login.headers().location ?? "");
    const state = authorizationUrl.searchParams.get("state");

    expect(state).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(authorizationUrl.searchParams.get("nonce")).toBe("nonce-from-authorization-request");
    expect(login.headers()["set-cookie"]).toBeUndefined();

    const callback = await request.get(
      `${baseUrl}/auth/callback?code=authorization-code&state=${encodeURIComponent(state ?? "")}`,
      { maxRedirects: 0 },
    );
    expect(callback.status()).toBe(302);
    expect(callback.headers().location).toBe("/transactions?month=2025-01");
    expect(callback.headers()["set-cookie"]).toContain("ff_session=");
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
  }
});

test("unauthenticated app access redirects to login", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    const response = await request.get(`${baseUrl}/admin/master-data`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe("/auth/login?returnTo=%2Fadmin%2Fmaster-data");
  } finally {
    await server.close();
  }
});

test("authenticated test user sees the dashboard shell", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);

    await loginAsTestUserRequest(request, baseUrl);
    const response = await request.get(`${baseUrl}/`);
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain("Übersicht");
    expect(body).toContain("Angemeldet als Test User");
  } finally {
    await server.close();
  }
});

function sequence(values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? "unexpected-token";
}

function signedIdToken(
  privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"],
  issuer: string,
  nonce: string,
): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "e2e-key", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuer,
      aud: "family-flow-client",
      exp: 1_900_000_000,
      sub: "oidc-subject",
      name: "OIDC User",
      email: "oidc@example.invalid",
      nonce,
    }),
  ).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString(
    "base64url",
  );
  return `${header}.${payload}.${signature}`;
}

test("E2E-FF-AUTH-005-01: logout revokes a copied opaque session", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    const loginResponse = await request.get(`${baseUrl}/auth/test-login`, { maxRedirects: 0 });
    const sessionCookie = loginResponse.headers()["set-cookie"]?.split(";", 1)[0];
    expect(sessionCookie).toMatch(/^ff_session=[A-Za-z0-9_-]{43}$/);

    const logoutResponse = await request.post(`${baseUrl}/auth/logout`, {
      headers: { Origin: "http://127.0.0.1:3000" },
      maxRedirects: 0,
    });
    expect(logoutResponse.status()).toBe(302);

    const replay = await fetch(`${baseUrl}/transactions`, {
      headers: { Cookie: sessionCookie ?? "" },
      redirect: "manual",
    });
    expect(replay.status).toBe(302);
    expect(replay.headers.get("location")).toBe("/auth/login?returnTo=%2Ftransactions");
  } finally {
    await server.close();
  }
});
