import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const evidenceId = /\b(?:E2E|UNIT|INT|SMOKE)-FF-[A-Z]+-[0-9]{3}-[0-9]{2}\b/g;

export async function collectDeclaredEvidence(repositoryRoot: string): Promise<Set<string>> {
  const environment = { PATH: process.env.PATH, HOME: process.env.HOME, CI: "true" };
  const vitestEnvironment = {
    ...environment,
    TEST_DATABASE_URL: "postgres://evidence-collection.invalid/family_flow",
  };
  const [vitest, playwright] = await Promise.all([
    execFileAsync(
      process.execPath,
      [resolve(repositoryRoot, "node_modules/vitest/vitest.mjs"), "list"],
      {
        cwd: repositoryRoot,
        env: vitestEnvironment,
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30_000,
      },
    ),
    execFileAsync(
      process.execPath,
      [resolve(repositoryRoot, "node_modules/@playwright/test/cli.js"), "test", "--list"],
      {
        cwd: repositoryRoot,
        env: environment,
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30_000,
      },
    ),
  ]);
  return new Set(`${vitest.stdout}\n${playwright.stdout}`.match(evidenceId) ?? []);
}
