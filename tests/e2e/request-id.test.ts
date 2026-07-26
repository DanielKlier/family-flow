import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";

test("successful responses include X-Request-Id", async ({ request }) => {
  const server = buildServer();

  await server.listen({ host: "127.0.0.1", port: 0 });

  try {
    const address = server.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to listen on a TCP port");
    }

    const response = await request.get(`http://127.0.0.1:${address.port}/health`);

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

  await server.listen({ host: "127.0.0.1", port: 0 });

  try {
    const address = server.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to listen on a TCP port");
    }

    const response = await request.get(`http://127.0.0.1:${address.port}/missing`);

    expect(response.status()).toBe(404);
    expect(response.headers()["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  } finally {
    await server.close();
  }
});
