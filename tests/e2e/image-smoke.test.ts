import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const imageName = "family-flow-phase-10b-smoke";
const networkName = "family-flow-phase-10b-smoke-network";
const postgresName = "family-flow-phase-10b-smoke-postgres";
const appName = "family-flow-phase-10b-smoke-app";

function docker(arguments_: string[]): Buffer;
function docker(arguments_: string[], encoding: "utf8"): string;
function docker(arguments_: string[], encoding?: "utf8"): string | Buffer {
  return execFileSync("docker", arguments_, { stdio: "pipe", encoding });
}

async function waitForPostgres(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      docker(["exec", postgresName, "pg_isready", "-U", "family_flow", "-d", "family_flow"]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error("isolated PostgreSQL container did not become ready");
}

async function waitForApp(baseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("production image did not start; inspect its container logs");
}

test("SMOKE-FF-DEP-001-01 production image packages templates and serves full and HTMX transaction responses", async () => {
  docker(["build", "--tag", imageName, "."]);

  const packagedTemplates = docker(
    [
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      imageName,
      "-c",
      "find /app/dist/views -type f -name '*.njk' -print",
    ],
    "utf8",
  );
  expect(packagedTemplates).toContain("/app/dist/views/transactions.njk");

  try {
    docker(["network", "create", networkName]);
    docker([
      "run",
      "--detach",
      "--name",
      postgresName,
      "--network",
      networkName,
      "--env",
      "POSTGRES_DB=family_flow",
      "--env",
      "POSTGRES_USER=family_flow",
      "--env",
      "POSTGRES_PASSWORD=family_flow",
      "postgres:17-alpine",
    ]);
    await waitForPostgres();
    docker([
      "run",
      "--detach",
      "--name",
      appName,
      "--network",
      networkName,
      "--publish",
      "127.0.0.1::3000",
      "--env",
      "NODE_ENV=production",
      "--env",
      "HOST=0.0.0.0",
      "--env",
      "PORT=3000",
      "--env",
      "BASE_URL=http://127.0.0.1:3000",
      "--env",
      "AUTH_MODE=test",
      "--env",
      "DATABASE_URL=postgres://family_flow:family_flow@family-flow-phase-10b-smoke-postgres:5432/family_flow",
      imageName,
    ]);
    const publishedPort = docker(["port", appName, "3000/tcp"], "utf8").trim().split(":").at(-1);
    if (publishedPort === undefined) throw new Error("production image did not publish port 3000");
    const baseUrl = `http://127.0.0.1:${publishedPort}`;
    await waitForApp(baseUrl);

    const login = await fetch(`${baseUrl}/auth/test-login`, { redirect: "manual" });
    const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toBeDefined();
    const headers = { Cookie: cookie ?? "" };
    const fullPage = await fetch(`${baseUrl}/transactions`, { headers });
    const fragment = await fetch(`${baseUrl}/transactions`, {
      headers: { ...headers, "HX-Request": "true" },
    });

    expect(fullPage.status).toBe(200);
    expect(await fullPage.text()).toEqual(
      expect.stringContaining('<link rel="stylesheet" href="/assets/app.css">'),
    );
    expect(fragment.status).toBe(200);
    const fragmentBody = await fragment.text();
    expect(fragmentBody).toContain('id="transactions-list"');
    expect(fragmentBody).not.toContain("<!doctype html>");
  } finally {
    for (const resource of [appName, postgresName]) {
      try {
        docker(["rm", "--force", resource]);
      } catch {
        // Cleanup must not hide the smoke assertion failure.
      }
    }
    try {
      docker(["network", "rm", networkName]);
    } catch {
      // Cleanup must not hide the smoke assertion failure.
    }
  }
});
