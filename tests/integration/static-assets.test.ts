import { describe, expect, it } from "vitest";

import { buildServer } from "../../src/app/server.js";

async function listen(server: ReturnType<typeof buildServer>) {
  await server.listen({ host: "127.0.0.1", port: 0 });

  const address = server.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the test server to listen on a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}

describe("static assets", () => {
  it("serves the application stylesheet with a CSS content type", async () => {
    const server = buildServer();

    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/assets/app.css`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/css");
      expect(body).toContain(".app-shell");
    } finally {
      await server.close();
    }
  });
});
