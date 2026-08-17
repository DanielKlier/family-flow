import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const imageName = "family-flow-phase-10b-smoke";
const networkName = "family-flow-phase-10b-smoke-network";
const postgresName = "family-flow-phase-10b-smoke-postgres";
const appName = "family-flow-phase-10b-smoke-app";
const smokeTimeoutMs = 120_000;

test.setTimeout(smokeTimeoutMs);

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

function cleanupSmokeResources(): void {
  for (const resource of [appName, postgresName]) {
    try {
      docker(["rm", "--force", resource]);
    } catch {
      // Missing resources are already clean.
    }
  }
  try {
    docker(["network", "rm", networkName]);
  } catch {
    // A missing network is already clean.
  }
}

test("SMOKE-FF-DEP-001-01 production image packages every template family and serves full and HTMX responses", async () => {
  cleanupSmokeResources();
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
  for (const template of [
    "/app/dist/views/layouts/app.njk",
    "/app/dist/views/pages/dashboard.njk",
    "/app/dist/views/pages/resource-error.njk",
    "/app/dist/views/pages/master-data.njk",
    "/app/dist/views/pages/categorization-rules.njk",
    "/app/dist/views/pages/income.njk",
    "/app/dist/views/pages/csv-import.njk",
    "/app/dist/views/pages/transactions.njk",
    "/app/dist/views/partials/income-panel.njk",
    "/app/dist/views/partials/transactions-list.njk",
  ]) {
    expect(packagedTemplates).toContain(template);
  }

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
    for (const path of [
      "/",
      "/admin/master-data",
      "/categorization-rules",
      "/income",
      "/imports/csv",
      "/transactions",
    ]) {
      const response = await fetch(`${baseUrl}${path}`, { headers });
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toContain(
        '<link rel="stylesheet" href="/assets/app.css">',
      );
    }

    const transactionList = await fetch(`${baseUrl}/transactions`, {
      headers: { ...headers, "HX-Request": "true" },
    });
    const incomePanel = await fetch(`${baseUrl}/income`, {
      headers: { ...headers, "HX-Request": "true" },
    });
    const createUnsafeTransaction = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      redirect: "manual",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "15.07.2026",
        description: "<script>globalThis.familyFlowXss=true</script>",
        amount: "42,99",
        status: "booked",
      }),
    });
    expect(createUnsafeTransaction.status).toBe(302);
    const escapedTransactions = await fetch(`${baseUrl}/transactions`, { headers });

    expect(transactionList.status).toBe(200);
    expect(await transactionList.text()).toContain('id="transactions-list"');
    expect(await incomePanel.text()).toContain('id="income-panel"');
    const escapedBody = await escapedTransactions.text();
    expect(escapedBody).toContain("&lt;script&gt;globalThis.familyFlowXss=true&lt;/script&gt;");
    expect(escapedBody).not.toContain("<script>globalThis.familyFlowXss=true</script>");
  } finally {
    cleanupSmokeResources();
  }
});
