import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/pull-request.yml";

async function readWorkflow(): Promise<string> {
  return readFile(workflowPath, "utf8");
}

describe("pull request workflow", () => {
  it("runs for pull requests with least-privilege, secret-free access", async () => {
    const workflow = await readWorkflow();
    const permissions = workflow.match(/^permissions:\n(?<entries>(?: {2}[^\n]+\n?)*)/m)?.groups
      ?.entries;

    expect(workflow).toMatch(/^on:\n\s+pull_request:/m);
    expect(workflow).not.toMatch(/pull_request_target:/);
    expect(permissions?.trim()).toBe("contents: read");
    expect(workflow).not.toMatch(/\b[\w-]+:\s*write\b/i);
    expect(workflow).not.toMatch(/\bsecrets\s*\./i);
    expect(workflow).toMatch(
      /uses:\s*actions\/checkout@[0-9a-f]{40}[\s\S]{0,200}?persist-credentials:\s*false/i,
    );
    const actionReferences = workflow.match(/^\s*uses:\s*\S+$/gm) ?? [];

    expect(actionReferences).not.toHaveLength(0);
    for (const reference of actionReferences) {
      expect(reference).toMatch(/@[0-9a-f]{40}\s*$/i);
    }
  });

  it("uses the locked Node, pnpm, and browser test toolchain", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toMatch(/node-version:\s*["']?24["']?/);
    expect(workflow).toMatch(/corepack enable/i);
    expect(workflow).toMatch(/pnpm@11\.5\.2/);
    expect(workflow).toMatch(/pnpm install --frozen-lockfile/);
    expect(workflow).toMatch(
      /pnpm exec playwright install(?: --with-deps chromium| chromium --with-deps)/,
    );
  });

  it("runs every application and Docker gate sequentially in one Ubuntu job", async () => {
    const workflow = await readWorkflow();
    const jobs = workflow.slice(workflow.indexOf("jobs:"));
    const jobNames = jobs.match(/^ {2}[\w-]+:\s*$/gm);
    const gates = [
      "pnpm verify",
      "env -u TEST_DATABASE_URL pnpm test:postgres",
      "docker compose --env-file .env.example config",
      "docker compose --env-file .env.example -f compose.prod.yaml config",
      "pnpm docker:build",
    ];
    const gatePositions = gates.map((gate) => workflow.indexOf(gate));

    expect(jobNames).toHaveLength(1);
    expect(workflow).toMatch(/runs-on:\s*ubuntu-/);
    expect(gatePositions).not.toContain(-1);
    expect(gatePositions).toEqual([...gatePositions].sort((left, right) => left - right));
  });
});
