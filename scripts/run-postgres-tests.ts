import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const project = `family-flow-test-${process.pid}-${randomBytes(4).toString("hex")}`;
const compose = ["compose", "-f", "compose.test.yaml", "-p", project];
let activeChild: ChildProcess | undefined;
let receivedSignal: NodeJS.Signals | undefined;

function run(command: string, args: string[], env = process.env): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild = child;
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (activeChild === child) activeChild = undefined;
      if (code === 0) resolve(stdout.trim());
      else {
        const output = sanitize(`${stdout}${stderr}`, env).trim();
        const status = `${command} exited with ${code ?? signal ?? "unknown status"}`;
        reject(new Error(output ? `${output}\n${status}` : status));
      }
    });
  });
}

function sanitize(output: string, environment: NodeJS.ProcessEnv): string {
  let sanitized = output.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[REDACTED_DATABASE_URL]");
  for (const [name, value] of Object.entries(environment)) {
    if (!/(?:SECRET|TOKEN|PASSWORD|DATABASE_URL)/i.test(name) || !value) continue;
    sanitized = sanitized.replaceAll(value, `[REDACTED_${name}]`);
  }
  return sanitized;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    receivedSignal = signal;
    if (activeChild?.pid !== undefined && process.platform !== "win32") {
      try {
        process.kill(-activeChild.pid, signal);
      } catch {
        // The child may already have exited between signal delivery and cleanup.
      }
    } else {
      activeChild?.kill(signal);
    }
  });
}

type EvidencePlan = Readonly<{ commands: readonly (readonly string[])[] }>;

const defaultEvidencePlan: EvidencePlan = {
  commands: [
    ["exec", "vitest", "run", "--no-file-parallelism"],
    ["exec", "playwright", "test", "tests/e2e/restore-smoke.test.ts", "--workers=1"],
  ],
};

function requestedOperation(arguments_: string[]): string | undefined {
  if (arguments_.length === 0) return undefined;
  if (arguments_.length !== 2 || arguments_[0] !== "--operation") {
    throw new Error("Usage: tsx scripts/run-postgres-tests.ts [--operation <OPS-ID>]");
  }
  const id = arguments_[1];
  if (!/^OPS-[A-Z0-9-]+$/.test(id)) throw new Error(`Unsupported PostgreSQL operation: ${id}`);
  return id;
}

async function loadEvidencePlan(operation: string | undefined): Promise<EvidencePlan> {
  if (operation === undefined) return defaultEvidencePlan;
  let source: string;
  try {
    source = await readFile(
      new URL(`./postgres-test-operations/${operation}.json`, import.meta.url),
      "utf8",
    );
  } catch {
    throw new Error(`Unsupported PostgreSQL operation: ${operation}`);
  }
  const plan: unknown = JSON.parse(source);
  if (!isEvidencePlan(plan)) {
    throw new Error(`Invalid PostgreSQL evidence plan: ${operation}`);
  }
  return plan;
}

function isEvidencePlan(value: unknown): value is EvidencePlan {
  if (typeof value !== "object" || value === null || !("commands" in value)) return false;
  return (
    Array.isArray(value.commands) &&
    value.commands.every(
      (command) =>
        Array.isArray(command) && command.every((argument) => typeof argument === "string"),
    )
  );
}

async function runEvidence(plan: EvidencePlan, environment: NodeJS.ProcessEnv): Promise<void> {
  for (const command of plan.commands) {
    await run("pnpm", [...command], environment);
    if (receivedSignal) return;
  }
}

async function main(): Promise<void> {
  let failure: unknown;
  try {
    const operation = requestedOperation(process.argv.slice(2));
    const evidencePlan = await loadEvidencePlan(operation);
    await run("docker", [...compose, "up", "-d", "--wait", "postgres"]);
    const address = await run("docker", [...compose, "port", "postgres", "5432"]);
    const match = /(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):([0-9]+)$/.exec(address);
    if (!match) throw new Error("docker compose returned an invalid PostgreSQL port");
    const testEnvironment = {
      ...process.env,
      TEST_DATABASE_URL: `postgres://family_flow_test:family_flow_test@127.0.0.1:${match[1]}/family_flow_test`,
    };
    await runEvidence(evidencePlan, testEnvironment);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await run("docker", [...compose, "down", "--volumes", "--remove-orphans"]);
    } catch (cleanupError) {
      failure ??= cleanupError;
    }
  }
  if (receivedSignal) process.exitCode = receivedSignal === "SIGINT" ? 130 : 143;
  else if (failure) throw failure;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "PostgreSQL test runner failed"}\n`,
  );
  process.exitCode = 1;
});
