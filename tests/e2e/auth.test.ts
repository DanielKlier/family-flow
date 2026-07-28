import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";

async function listen(server: ReturnType<typeof buildServer>) {
  await server.listen({ host: "127.0.0.1", port: 0 });

  const address = server.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the test server to listen on a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}

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

    await request.get(`${baseUrl}/auth/test-login`);
    const response = await request.get(`${baseUrl}/`);
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain("Dashboard");
    expect(body).toContain("Signed in as Test User");
  } finally {
    await server.close();
  }
});

test("logout ends the session", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);

    await request.get(`${baseUrl}/auth/test-login?returnTo=/admin/master-data`);
    const authenticatedResponse = await request.get(`${baseUrl}/admin/master-data`);
    expect(authenticatedResponse.status()).toBe(200);

    await request.get(`${baseUrl}/auth/logout`);
    const response = await request.get(`${baseUrl}/admin/master-data`, { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe("/auth/login?returnTo=%2Fadmin%2Fmaster-data");
  } finally {
    await server.close();
  }
});
