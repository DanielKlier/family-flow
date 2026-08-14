import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("operations manual", () => {
  it("documents categorization rule maintenance", async () => {
    const manual = await readFile("OPERATIONS.md", "utf8");

    expect(manual).toContain("## Categorization Rule Maintenance");
    expect(manual).toContain("/categorization-rules");
    expect(manual).toContain("Apply rules to existing transactions");
  });

  it("documents income planning maintenance", async () => {
    const manual = await readFile("OPERATIONS.md", "utf8");

    expect(manual).toContain("## Income Planning Maintenance");
    expect(manual).toContain("/income");
    expect(manual).toContain("Monthly overrides replace the recurring amount");
  });

  it("requires restored-session invalidation before application startup", async () => {
    const manual = await readFile("OPERATIONS.md", "utf8");
    const restore = manual.slice(manual.indexOf("## Restore "), manual.indexOf("## Debugging"));

    expect(restore).toMatch(
      /restore a PostgreSQL dump[\s\S]*session-invalidate\.js[\s\S]*session-cleanup\.js[\s\S]*start the app/i,
    );
  });

  it("documents secret-free, least-privilege pull request checks for Dependabot", async () => {
    const manual = await readFile("OPERATIONS.md", "utf8");
    const pullRequestChecks = manual.slice(
      manual.indexOf("## Pull Request Checks"),
      manual.indexOf("## Quality And Operations Evidence"),
    );

    expect(manual).toContain("## Pull Request Checks");
    expect(pullRequestChecks).toContain("pull_request");
    expect(pullRequestChecks).toContain("Dependabot");
    expect(pullRequestChecks).toContain("contents: read");
    expect(pullRequestChecks).toMatch(/no secrets/i);
    expect(pullRequestChecks).toMatch(/sequential/i);
    expect(pullRequestChecks).toContain("pnpm verify");
    expect(pullRequestChecks).toContain("env -u TEST_DATABASE_URL pnpm test:postgres");
    expect(pullRequestChecks).toContain("docker compose --env-file .env.example config");
    expect(pullRequestChecks).toContain(
      "docker compose --env-file .env.example -f compose.prod.yaml config",
    );
    expect(pullRequestChecks).toContain("pnpm docker:build");
  });
});
