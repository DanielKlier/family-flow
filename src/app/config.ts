export type NodeEnv = "development" | "test" | "production";

export type AppConfig = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  baseUrl: string;
  databaseUrl: string;
};

type Environment = Record<string, string | undefined>;

const nodeEnvs = new Set<NodeEnv>(["development", "test", "production"]);

export function loadConfig(environment: Environment = process.env): AppConfig {
  const nodeEnv = readNodeEnv(environment.NODE_ENV ?? "development");
  const host = readRequiredString(environment.HOST, "HOST");
  const port = readPort(environment.PORT);
  const baseUrl = readUrl(environment.BASE_URL, "BASE_URL");
  const databaseUrl = readRequiredString(environment.DATABASE_URL, "DATABASE_URL");

  return {
    nodeEnv,
    host,
    port,
    baseUrl,
    databaseUrl,
  };
}

function readNodeEnv(value: string): NodeEnv {
  if (nodeEnvs.has(value as NodeEnv)) {
    return value as NodeEnv;
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
