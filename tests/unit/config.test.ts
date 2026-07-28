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
      AUTH_MODE: "test",
      SESSION_SECRET: "test-session-secret-with-enough-length",
    });

    expect(config).toEqual({
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 3000,
      baseUrl: "https://finances.home.arpa",
      databaseUrl: "postgres://family_flow:family_flow@localhost:5432/family_flow",
      auth: {
        mode: "test",
        sessionSecret: "test-session-secret-with-enough-length",
        oidc: null,
      },
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
        AUTH_MODE: "test",
        SESSION_SECRET: "test-session-secret-with-enough-length",
      }),
    ).toThrow("PORT must be an integer between 1 and 65535");
  });

  it("loads valid OIDC authentication configuration", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      HOST: "0.0.0.0",
      PORT: "3000",
      BASE_URL: "https://finances.home.arpa",
      DATABASE_URL: "postgres://family_flow:family_flow@postgres:5432/family_flow",
      AUTH_MODE: "oidc",
      SESSION_SECRET: "production-session-secret-with-enough-length",
      OIDC_ISSUER_URL: "https://authentik.home.arpa/application/o/family-flow/",
      OIDC_CLIENT_ID: "family-flow",
      OIDC_CLIENT_SECRET: "client-secret-placeholder",
    });

    expect(config.auth).toEqual({
      mode: "oidc",
      sessionSecret: "production-session-secret-with-enough-length",
      oidc: {
        issuerUrl: "https://authentik.home.arpa/application/o/family-flow",
        clientId: "family-flow",
        clientSecret: "client-secret-placeholder",
      },
    });
  });

  it("rejects OIDC mode without an issuer URL", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "3000",
        BASE_URL: "https://finances.home.arpa",
        DATABASE_URL: "postgres://family_flow:family_flow@postgres:5432/family_flow",
        AUTH_MODE: "oidc",
        SESSION_SECRET: "production-session-secret-with-enough-length",
        OIDC_CLIENT_ID: "family-flow",
        OIDC_CLIENT_SECRET: "client-secret-placeholder",
      }),
    ).toThrow("OIDC_ISSUER_URL is required");
  });
});
