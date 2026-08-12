import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("INT-FF-QUA-004-01 PostgreSQL quality gate", () => {
  it.each(["success", "test"])("always removes Compose resources on %s", async (failurePoint) => {
    const harness = await createHarness(failurePoint);
    const result = await run(harness.environment);
    const calls = await readFile(harness.log, "utf8");

    expect(calls).toContain(" up ");
    expect(calls).toContain(" down ");
    expect(calls).toContain("--volumes");
    if (failurePoint === "success") {
      expect(result.code, result.stderr).toBe(0);
      expect(calls).toContain("vitest run --no-file-parallelism");
    } else {
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("vitest failure marker");
      expect(result.stderr).not.toContain("postgres://family_flow_test");
      expect(result.stderr).not.toContain("secret-marker");
    }
  });

  it("preserves SIGTERM semantics and still cleans up", async () => {
    const harness = await createHarness("signal");
    const child = spawn(resolve("node_modules/.bin/tsx"), ["scripts/run-postgres-tests.ts"], {
      cwd: repositoryRoot,
      env: harness.environment,
      stdio: "ignore",
    });
    await waitForLog(harness.log, "vitest run");
    child.kill("SIGTERM");
    const code = await new Promise<number | null>((resolvePromise) =>
      child.on("close", resolvePromise),
    );

    expect(code).toBe(143);
    expect(await readFile(harness.log, "utf8")).toContain(" down ");
  });
});

async function run(
  environment: NodeJS.ProcessEnv,
): Promise<{ code: number | null; stderr: string }> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(resolve("node_modules/.bin/tsx"), ["scripts/run-postgres-tests.ts"], {
      cwd: repositoryRoot,
      env: environment,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ code, stderr }));
  });
}

async function createHarness(failurePoint: string) {
  const directory = await mkdtemp(join(tmpdir(), "family-flow-postgres-runner-"));
  temporaryDirectories.push(directory);
  const bin = join(directory, "bin");
  const log = join(directory, "calls.log");
  await mkdir(bin);
  await writeFile(log, "");
  await writeFile(
    join(bin, "docker"),
    `#!/bin/sh\necho "docker $*" >> "$HARNESS_LOG"\ncase " $* " in\n  *" port "*) echo '127.0.0.1:49123';;\nesac\nexit 0\n`,
    { mode: 0o755 },
  );
  await writeFile(
    join(bin, "pnpm"),
    `#!/bin/sh\necho "pnpm $*" >> "$HARNESS_LOG"\nif [ "$FAIL_POINT" = test ]; then\n  echo "vitest failure marker $TEST_DATABASE_URL $SESSION_SECRET"\n  exit 43\nfi\n[ "$FAIL_POINT" = signal ] && sleep 30\nexit 0\n`,
    { mode: 0o755 },
  );
  return {
    log,
    environment: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      HARNESS_LOG: log,
      FAIL_POINT: failurePoint,
      SESSION_SECRET: "secret-marker",
    },
  };
}

async function waitForLog(path: string, text: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await readFile(path, "utf8")).includes(text)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error(`Timed out waiting for ${text}`);
}
