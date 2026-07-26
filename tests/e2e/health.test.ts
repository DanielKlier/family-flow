import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";

test("GET /health returns an ok status", async ({ request }) => {
  const server = buildServer();

  await server.listen({ host: "127.0.0.1", port: 0 });

  try {
    const address = server.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to listen on a TCP port");
    }

    const response = await request.get(`http://127.0.0.1:${address.port}/health`);

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  } finally {
    await server.close();
  }
});
