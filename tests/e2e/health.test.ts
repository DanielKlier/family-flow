import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { listen } from "../support/server.js";

test("GET /health returns an ok status", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    const response = await request.get(`${baseUrl}/health`);

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  } finally {
    await server.close();
  }
});
