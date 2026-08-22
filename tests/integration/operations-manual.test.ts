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

  it("documents an executable PostgreSQL backup and safe restore reconciliation runbook", async () => {
    const [manual, recoveryEvidence] = await Promise.all([
      readFile("OPERATIONS.md", "utf8"),
      readFile("scripts/recovery-evidence.sql", "utf8"),
    ]);
    const backup = manual.slice(manual.indexOf("## Backup "), manual.indexOf("## Restore "));
    const restore = manual.slice(manual.indexOf("## Restore "), manual.indexOf("## Debugging"));

    expect(backup).toMatch(/maintenance mode/i);
    expect(backup).toMatch(
      /stop external traffic[\s\S]*stop app[\s\S]*recovery-evidence\.sql[\s\S]*pg_dump/i,
    );
    expect(backup).toMatch(/recovery-evidence\.sql[\s\S]*compare[\s\S]*start the app/i);
    expect(backup).toMatch(/trap[\s\S]*start the app/i);
    expect(backup).toContain("scripts/recovery-evidence.sql");
    expect(backup).toMatch(/manifest/i);
    expect(backup).toMatch(/sha256|checksum/i);
    expect(recoveryEvidence).toContain("monthly_override_total_cents");
    expect(recoveryEvidence).toContain("schema_migrations");
    expect(recoveryEvidence).toContain("seed_inventory");
    expect(recoveryEvidence).toContain("active_states");
    expect(recoveryEvidence).toContain("orphan_counts");
    expect(restore).toMatch(
      /stop[\s\S]*restore[\s\S]*session-invalidate\.js[\s\S]*session-cleanup\.js[\s\S]*start/i,
    );
    expect(restore).toMatch(/reconcil/i);
    expect(restore).toMatch(/foreign.key|reference/i);
    expect(restore).toMatch(/rollback/i);
    expect(restore).toMatch(/retention/i);
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
