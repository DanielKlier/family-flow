import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const evidenceId = /\b(?:E2E|UNIT|INT|SMOKE)-FF-[A-Z]+-[0-9]{3}-[0-9]{2}\b/g;

export async function collectDeclaredEvidence(repositoryRoot: string): Promise<Set<string>> {
  const environment = { PATH: process.env.PATH, HOME: process.env.HOME, CI: "true" };
  const [vitest, playwright] = await Promise.all([
    execFileAsync("pnpm", ["exec", "vitest", "list"], {
      cwd: repositoryRoot,
      env: environment,
      maxBuffer: 16 * 1024 * 1024,
    }),
    execFileAsync("pnpm", ["exec", "playwright", "test", "--list"], {
      cwd: repositoryRoot,
      env: environment,
      maxBuffer: 16 * 1024 * 1024,
    }),
  ]);
  return new Set(`${vitest.stdout}\n${playwright.stdout}`.match(evidenceId) ?? []);
}
