import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserRequest } from "../support/auth.js";
import { listen } from "../support/server.js";

test("successful responses include X-Request-Id", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    const response = await request.get(`${baseUrl}/health`);

    expect(response.status()).toBe(200);
    expect(response.headers()["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  } finally {
    await server.close();
  }
});

test("error responses include X-Request-Id", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    const response = await request.get(`${baseUrl}/missing`);

    expect(response.status()).toBe(404);
    expect(response.headers()["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  } finally {
    await server.close();
  }
});
