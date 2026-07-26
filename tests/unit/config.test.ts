import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/app/config.js";

describe("loadConfig", () => {
  it("loads a valid application configuration", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "3000",
      BASE_URL: "https://finances.home.arpa",
      DATABASE_URL: "postgres://family_flow:family_flow@localhost:5432/family_flow",
    });

    expect(config).toEqual({
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 3000,
      baseUrl: "https://finances.home.arpa",
      databaseUrl: "postgres://family_flow:family_flow@localhost:5432/family_flow",
    });
  });

  it("rejects an invalid port", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "invalid",
        BASE_URL: "https://finances.home.arpa",
        DATABASE_URL: "postgres://family_flow:family_flow@localhost:5432/family_flow",
      }),
    ).toThrow("PORT must be an integer between 1 and 65535");
  });
});
