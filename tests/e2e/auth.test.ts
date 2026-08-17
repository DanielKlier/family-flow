import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserRequest } from "../support/auth.js";
import { listen } from "../support/server.js";

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
