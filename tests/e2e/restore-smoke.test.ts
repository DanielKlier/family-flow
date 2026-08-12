import { spawn } from "node:child_process";

import { expect, test } from "@playwright/test";

import { Sha256SessionTokenHasher } from "../../src/adapters/auth/session-cryptography.js";
import { DrizzleSessionStore } from "../../src/adapters/db/drizzle-session-store.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { sessions } from "../../src/adapters/db/schema.js";
import { buildServer } from "../../src/app/server.js";
import { SessionService } from "../../src/core/auth/session-service.js";
import { listen } from "../support/server.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

async function runInvalidationEntryPoint(databaseUrl: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", "src/app/session-invalidate.ts"], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "3000",
        BASE_URL: "http://127.0.0.1:3000",
        DATABASE_URL: databaseUrl,
        AUTH_MODE: "test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `session invalidation exited with ${code}`));
    });
  });
}

function postgresSessionService(connection: ReturnType<typeof createPostgresConnection>) {
  return new SessionService(
    new DrizzleSessionStore(connection.db),
    { now: () => new Date("2025-01-01T00:00:00.000Z") },
    {
      generate: () => "r".repeat(43),
      generateId: () => "00000000-0000-4000-8000-000000000009",
    },
    new Sha256SessionTokenHasher(),
  );
}

test("SMOKE-FF-AUTH-009-01 old signed cookies are rejected by PostgreSQL sessions", async () => {
  test.skip(testDatabaseUrl === undefined, "requires the isolated PostgreSQL runner");
  if (testDatabaseUrl === undefined) return;
  await migrate(testDatabaseUrl);
  const connection = createPostgresConnection(testDatabaseUrl);
  await connection.db.delete(sessions);
  const server = buildServer({ sessions: postgresSessionService(connection) });
  try {
    const baseUrl = await listen(server);
    const response = await fetch(`${baseUrl}/transactions`, {
      headers: { Cookie: "ff_session=legacy.payload.signature" },
      redirect: "manual",
    });
    expect(response.status).toBe(302);
  } finally {
    await server.close();
    await connection.client.end();
  }
});

test("SMOKE-FF-AUTH-009-02 restored session rows are invalidated before server startup", async () => {
  test.skip(testDatabaseUrl === undefined, "requires the isolated PostgreSQL runner");
  if (testDatabaseUrl === undefined) return;
  await migrate(testDatabaseUrl);
  const backupConnection = createPostgresConnection(testDatabaseUrl);
  await backupConnection.db.delete(sessions);
  const backupServer = buildServer({ sessions: postgresSessionService(backupConnection) });
  let capturedCookie = "";
  try {
    const baseUrl = await listen(backupServer);
    const login = await fetch(`${baseUrl}/auth/test-login`, { redirect: "manual" });
    capturedCookie = login.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    expect(capturedCookie).toMatch(/^ff_session=[A-Za-z0-9_-]{43}$/);
    const beforeBackup = await fetch(`${baseUrl}/transactions`, {
      headers: { Cookie: capturedCookie },
      redirect: "manual",
    });
    expect(beforeBackup.status).toBe(200);

    const [backedUpRow] = await backupConnection.db.select().from(sessions);
    expect(backedUpRow).toBeDefined();
    await backupConnection.db.delete(sessions);
    if (backedUpRow !== undefined) await backupConnection.db.insert(sessions).values(backedUpRow);
  } finally {
    await backupServer.close();
    await backupConnection.client.end();
  }

  await runInvalidationEntryPoint(testDatabaseUrl);

  const restoredConnection = createPostgresConnection(testDatabaseUrl);
  const restoredServer = buildServer({ sessions: postgresSessionService(restoredConnection) });
  try {
    const baseUrl = await listen(restoredServer);
    const replay = await fetch(`${baseUrl}/transactions`, {
      headers: { Cookie: capturedCookie },
      redirect: "manual",
    });
    expect(replay.status).toBe(302);
    expect(replay.headers.get("location")).toBe("/auth/login?returnTo=%2Ftransactions");
  } finally {
    await restoredServer.close();
    await restoredConnection.client.end();
  }
});
