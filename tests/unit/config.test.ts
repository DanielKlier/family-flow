import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/app/config.js";

const validProductionEnvironment = {
  NODE_ENV: "production",
  HOST: "0.0.0.0",
  PORT: "3000",
  BASE_URL: "https://finances.home.arpa",
  DATABASE_URL: "postgres://family_flow:family_flow@postgres:5432/family_flow",
  AUTH_MODE: "oidc",
  OIDC_ISSUER_URL: "https://authentik.home.arpa/application/o/family-flow",
  OIDC_CLIENT_ID: "family-flow",
  OIDC_CLIENT_SECRET: "production-client-secret",
};

describe("loadConfig", () => {
  it("loads a valid application configuration", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "3000",
      BASE_URL: "https://finances.home.arpa",
      DATABASE_URL: "postgres://family_flow:family_flow@localhost:5432/family_flow",
      AUTH_MODE: "test",
    });

    expect(config).toEqual({
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 3000,
      baseUrl: "https://finances.home.arpa",
      databaseUrl: "postgres://family_flow:family_flow@localhost:5432/family_flow",
      defaultLocale: "de-DE",
      auth: {
        mode: "test",
        oidc: null,
      },
    });
  });

  it("defaults the startup locale to German and accepts English", () => {
    const environment = {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "3000",
      BASE_URL: "https://finances.home.arpa",
      DATABASE_URL: "postgres://family_flow:family_flow@localhost:5432/family_flow",
      AUTH_MODE: "test",
    };

    expect(loadConfig(environment).defaultLocale).toBe("de-DE");
    expect(loadConfig({ ...environment, DEFAULT_LOCALE: "en" }).defaultLocale).toBe("en");
  });

  it("rejects an unsupported startup locale", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "3000",
        BASE_URL: "https://finances.home.arpa",
        DATABASE_URL: "postgres://family_flow:family_flow@localhost:5432/family_flow",
        AUTH_MODE: "test",
        DEFAULT_LOCALE: "fr-FR",
      }),
    ).toThrow("DEFAULT_LOCALE must be one of: de-DE, en");
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
      OIDC_ISSUER_URL: "https://authentik.home.arpa/application/o/family-flow/",
      OIDC_CLIENT_ID: "family-flow",
      OIDC_CLIENT_SECRET: "client-secret-placeholder",
    });

    expect(config.auth).toEqual({
      mode: "oidc",
      oidc: {
        issuerUrl: "https://authentik.home.arpa/application/o/family-flow",
        clientId: "family-flow",
        clientSecret: "client-secret-placeholder",
      },
    });
  });

  it.each([
    ["test mode", { AUTH_MODE: "test" }],
    ["non-HTTPS base URL", { BASE_URL: "http://finances.home.arpa" }],
    [
      "non-HTTPS issuer",
      { OIDC_ISSUER_URL: "http://authentik.home.arpa/application/o/family-flow" },
    ],
    ["Dex issuer", { OIDC_ISSUER_URL: "https://dex.example.invalid/dex" }],
    ["Dex development client ID", { OIDC_CLIENT_ID: "family-flow-dev" }],
    ["Dex development client secret", { OIDC_CLIENT_SECRET: "family-flow-dev-secret" }],
    [
      "committed development session placeholder",
      { SESSION_SECRET: "replace-with-at-least-32-random-characters" },
    ],
  ])("rejects production %s", (_description, override) => {
    expect(() => loadConfig({ ...validProductionEnvironment, ...override })).toThrow();
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
        OIDC_CLIENT_ID: "family-flow",
        OIDC_CLIENT_SECRET: "client-secret-placeholder",
      }),
    ).toThrow("OIDC_ISSUER_URL is required");
  });
});
