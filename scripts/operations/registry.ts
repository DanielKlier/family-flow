import { spawn } from "node:child_process";

export type OperationResult = {
  operationId: string;
  status: "passed" | "failed" | "skipped";
};
export type OperationVerifier = (
  environment: NodeJS.ProcessEnv,
) => Promise<OperationResult>;
export type OperationRegistry = Readonly<Record<string, OperationVerifier>>;

function verifyPostgresOperation(id: string): OperationVerifier {
  return async (environment) => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "pnpm",
        ["exec", "tsx", "scripts/run-postgres-tests.ts", "--operation", id],
        { env: environment, stdio: "inherit" },
      );
      child.on("error", reject);
      child.on("close", (code, signal) => {
        if (code === 0) resolve();
        else
          reject(
            new Error(`Operation ${id} verifier exited with ${code ?? signal}`),
          );
      });
    });
    return { operationId: id, status: "passed" };
  };
}

function verifyTestCommands(
  id: string,
  commands: string[][],
): OperationVerifier {
  return async (environment) => {
    for (const arguments_ of commands) {
      await runPnpmVerifier(id, arguments_, environment);
    }
    return { operationId: id, status: "passed" };
  };
}

function verifyPostgresAndTestCommands(
  id: string,
  commands: string[][],
): OperationVerifier {
  return async (environment) => {
    await verifyPostgresOperation(id)(environment);
    return verifyTestCommands(id, commands)(environment);
  };
}

function verifyVitestOperation(
  id: string,
  files: string | string[],
  testNamePattern?: string,
): OperationVerifier {
  const arguments_ = ["exec", "vitest", "run", ...[files].flat()];
  if (testNamePattern !== undefined)
    arguments_.push("--testNamePattern", testNamePattern);
  return verifyTestCommands(id, [arguments_]);
}

function runPnpmVerifier(
  id: string,
  arguments_: string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", arguments_, {
      env: environment,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`Operation ${id} verifier exited with ${code ?? signal}`),
        );
    });
  });
}

// Verifiers are registered here when their owning phase delivers executable operations evidence.
// Planned operations remain in traceability.json but cannot be dispatched until registered.
export const operationRegistry: OperationRegistry = {
  "OPS-FF-AUTH-002-01": verifyPostgresOperation("OPS-FF-AUTH-002-01"),
  "OPS-FF-AUTH-006-01": verifyPostgresOperation("OPS-FF-AUTH-006-01"),
  "OPS-FF-AUTH-009-01": verifyPostgresOperation("OPS-FF-AUTH-009-01"),
  "OPS-FF-CAT-002-01": verifyPostgresOperation("OPS-FF-CAT-002-01"),
  "OPS-FF-TXN-005-01": verifyPostgresOperation("OPS-FF-TXN-005-01"),
  "OPS-FF-LOC-002-01": verifyVitestOperation(
    "OPS-FF-LOC-002-01",
    "tests/integration/localization.test.ts",
  ),
  "OPS-FF-INC-001-01": verifyVitestOperation("OPS-FF-INC-001-01", [
    "tests/unit/income-plans.test.ts",
    "tests/integration/income-http.test.ts",
  ]),
  "OPS-FF-OPS-002-01": verifyTestCommands("OPS-FF-OPS-002-01", [
    [
      "exec",
      "playwright",
      "test",
      "tests/e2e/backup-restore-smoke.test.ts",
      "--grep",
      "SMOKE-FF-OPS-002-01",
      "--workers=1",
    ],
  ]),
  "OPS-FF-OPS-003-01": verifyTestCommands("OPS-FF-OPS-003-01", [
    [
      "exec",
      "playwright",
      "test",
      "tests/e2e/backup-restore-smoke.test.ts",
      "--grep",
      "SMOKE-FF-OPS-003-01",
      "--workers=1",
    ],
  ]),
  "OPS-FF-OBS-003-01": verifyTestCommands("OPS-FF-OBS-003-01", [
    [
      "exec",
      "vitest",
      "run",
      "tests/unit/request-log-context.test.ts",
      "tests/integration/request-logging.test.ts",
    ],
    ["exec", "playwright", "test", "tests/e2e/request-id.test.ts", "--workers=1"],
  ]),
  "OPS-FF-DASH-001-01": verifyPostgresAndTestCommands("OPS-FF-DASH-001-01", [
    [
      "exec",
      "vitest",
      "run",
      "tests/unit/dashboard.test.ts",
      "tests/integration/dashboard-http.test.ts",
      "--testNamePattern",
      "(?:UNIT|INT)-FF-DASH",
    ],
    [
      "exec",
      "playwright",
      "test",
      "tests/e2e/dashboard.test.ts",
      "--grep",
      "(?:E2E-FF-DASH|distinguishes localized past and future dashboard months)",
      "--workers=1",
    ],
  ]),
  "OPS-FF-DEV-001-01": verifyVitestOperation(
    "OPS-FF-DEV-001-01",
    "tests/integration/dev-oidc-compose.test.ts",
  ),
  "OPS-FF-DEP-002-01": verifyTestCommands("OPS-FF-DEP-002-01", [
    [
      "exec",
      "playwright",
      "test",
      "tests/e2e/deployment-smoke.test.ts",
      "--grep",
      "(?:SMOKE-FF-SCP-001-01|SMOKE-FF-DEP-002-01)",
      "--workers=1",
    ],
  ]),
  "OPS-FF-DEP-003-01": verifyTestCommands("OPS-FF-DEP-003-01", [
    [
      "exec",
      "playwright",
      "test",
      "tests/e2e/deployment-smoke.test.ts",
      "--grep",
      "(?:SMOKE-FF-SCP-001-02|SMOKE-FF-DEP-003-01)",
      "--workers=1",
    ],
  ]),
  "OPS-FF-FOR-001-01": verifyTestCommands("OPS-FF-FOR-001-01", [
    [
      "exec",
      "vitest",
      "run",
      "tests/unit/dashboard.test.ts",
      "--testNamePattern",
      "UNIT-FF-FOR",
    ],
    [
      "exec",
      "playwright",
      "test",
      "tests/e2e/dashboard.test.ts",
      "--grep",
      "(?:E2E-FF-FOR|distinguishes localized past and future dashboard months)",
      "--workers=1",
    ],
  ]),
};

export async function verifyOperation(
  id: string,
  registry: OperationRegistry = operationRegistry,
  inheritedEnvironment: NodeJS.ProcessEnv = process.env,
): Promise<OperationResult> {
  const verifier = registry[id];
  if (!verifier) throw new Error(`Unknown operation: ${id}`);
  const result = await verifier(safeEnvironment(inheritedEnvironment));
  if (result.operationId !== id)
    throw new Error(`Operation result mismatch for ${id}`);
  if (result.status !== "passed")
    throw new Error(`Operation ${id} ${result.status}`);
  return result;
}

function safeEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    PATH: environment.PATH,
    HOME: environment.HOME,
  };
}
