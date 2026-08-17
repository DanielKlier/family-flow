import { readDefaultLocale, type SupportedLocale } from "../adapters/localization/registry.js";

export type NodeEnv = "development" | "test" | "production";

export type AppConfig = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  baseUrl: string;
  databaseUrl: string;
  defaultLocale: SupportedLocale;
  auth: AuthConfig;
};

export type AuthConfig = {
  mode: "test" | "oidc";
  oidc: OidcConfig | null;
};

export type OidcConfig = {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
};

type Environment = Record<string, string | undefined>;

export function loadConfig(environment: Environment = process.env): AppConfig {
  const nodeEnv = readNodeEnv(environment.NODE_ENV ?? "development");
  const host = readRequiredString(environment.HOST, "HOST");
  const port = readPort(environment.PORT);
  const baseUrl = readUrl(environment.BASE_URL, "BASE_URL");
  const databaseUrl = readRequiredString(environment.DATABASE_URL, "DATABASE_URL");
  const defaultLocale = readDefaultLocale(environment.DEFAULT_LOCALE);
  const auth = readAuthConfig(environment, nodeEnv);

  return {
    nodeEnv,
    host,
    port,
    baseUrl,
    databaseUrl,
    defaultLocale,
    auth,
  };
}

function readNodeEnv(value: string): NodeEnv {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new Error("NODE_ENV must be one of development, test or production");
}

function readRequiredString(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}

function readPort(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return parsed;
}

function readUrl(value: string | undefined, name: string): string {
  const rawValue = readRequiredString(value, name);

  try {
    return new URL(rawValue).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function readAuthConfig(environment: Environment, nodeEnv: NodeEnv): AuthConfig {
  const mode = readAuthMode(environment.AUTH_MODE, nodeEnv);
  if (mode === "test") {
    return {
      mode,
      oidc: null,
    };
  }

  return {
    mode,
    oidc: {
      issuerUrl: readUrl(environment.OIDC_ISSUER_URL, "OIDC_ISSUER_URL"),
      clientId: readRequiredString(environment.OIDC_CLIENT_ID, "OIDC_CLIENT_ID"),
      clientSecret: readRequiredString(environment.OIDC_CLIENT_SECRET, "OIDC_CLIENT_SECRET"),
    },
  };
}

function readAuthMode(value: string | undefined, nodeEnv: NodeEnv): AuthConfig["mode"] {
  if (value === undefined || value.trim() === "") {
    if (nodeEnv === "production") {
      throw new Error("AUTH_MODE is required in production");
    }

    return "test";
  }

  if (value === "test" || value === "oidc") {
    return value;
  }

  throw new Error("AUTH_MODE must be test or oidc");
}
