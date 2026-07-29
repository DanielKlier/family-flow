import { describe, expect, it } from "vitest";

import { buildServer } from "../../src/app/server.js";
import { listen } from "../support/server.js";

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
