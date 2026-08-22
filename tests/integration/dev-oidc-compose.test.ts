import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Docker Compose commands", () => {
  it("provides a reproducible image build gate without local OIDC secrets", async () => {
    const [packageJsonText, readme, operations, tasks, plan, agentGuidance] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("README.md", "utf8"),
      readFile("OPERATIONS.md", "utf8"),
      readFile("TASKS.md", "utf8"),
      readFile("PLAN.md", "utf8"),
      readFile("AGENTS.md", "utf8"),
    ]);
    const packageJson = JSON.parse(packageJsonText) as { scripts: Record<string, string> };

    expect(packageJson.scripts["docker:build"]).toBe(
      "docker compose --env-file .env.example build",
    );
    for (const documentation of [readme, operations, tasks, plan, agentGuidance]) {
      expect(documentation).toContain("pnpm docker:build");
    }
  });
});

describe("local OIDC development compose", () => {
  it("INT-FF-DEV-001-01 preserves the deterministic Dex development contract and production separation", async () => {
    const [compose, dexConfig, devEnv, readme, operations] = await Promise.all([
      readFile("compose.dev.yaml", "utf8"),
      readFile("dev/dex/config.yaml", "utf8"),
      readFile(".env.dev", "utf8"),
      readFile("README.md", "utf8"),
      readFile("OPERATIONS.md", "utf8"),
    ]);

    expect(compose).toContain("dexidp/dex");
    expect(compose).toContain('"127.0.0.1:5556:5556"');
    expect(compose).toContain("./dev/dex/config.yaml:/etc/dex/config.yaml:ro");

    expect(dexConfig).toContain("issuer: http://127.0.0.1:5556/dex");
    expect(dexConfig).toContain("id: family-flow-dev");
    expect(dexConfig).toContain("secret: family-flow-dev-secret");
    expect(dexConfig).toContain("http://127.0.0.1:3000/auth/callback");
    expect(dexConfig).toContain("email: dev@example.invalid");

    expect(devEnv).toContain("BASE_URL=http://127.0.0.1:3000");
    expect(devEnv).toContain("AUTH_MODE=oidc");
    expect(devEnv).toContain("OIDC_ISSUER_URL=http://127.0.0.1:5556/dex");
    expect(devEnv).toContain("OIDC_CLIENT_ID=family-flow-dev");
    expect(devEnv).toContain("OIDC_CLIENT_SECRET=family-flow-dev-secret");

    expect(readme).toContain("pnpm dev:oidc");
    expect(readme).toContain("This mode is intended for running PostgreSQL and Dex in Docker");
    expect(operations).toContain("This local Dex setup is not intended for production");
  });
});
