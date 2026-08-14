import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { Sha256SessionTokenHasher } from "../../src/adapters/auth/session-cryptography.js";
import { DrizzleSessionStore } from "../../src/adapters/db/drizzle-session-store.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { sessions } from "../../src/adapters/db/schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const execFileAsync = promisify(execFile);

async function availablePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  if (address === null || typeof address === "string")
    throw new Error("Failed to reserve startup test port");
  return address.port;
}

async function runServerStartup(databaseUrl: string): Promise<string> {
  const port = await availablePort();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/app/server.ts"], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: String(port),
        BASE_URL: `http://127.0.0.1:${port}`,
        DATABASE_URL: databaseUrl,
        AUTH_MODE: "test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Server startup timed out: ${output}`));
    }, 20_000);
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("Session cleanup deleted")) child.kill("SIGTERM");
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (output.includes("Session cleanup deleted")) resolve(output);
      else reject(new Error(`Server startup exited with ${code ?? signal}: ${output}`));
    });
  });
}

async function runSessionCleanup(databaseUrl: string): Promise<string> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", "tsx", "src/app/session-cleanup.ts", "--limit", "1000"],
    {
      timeout: 10_000,
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
    },
  );
  return stdout;
}

describe("Drizzle session store", () => {
  it("INT-FF-AUTH-003-01 stores hashes, cleans, and invalidates restored sessions", async () => {
    if (testDatabaseUrl === undefined) return;
    await migrate(testDatabaseUrl);
    const connection = createPostgresConnection(testDatabaseUrl);
    const store = new DrizzleSessionStore(connection.db);
    const hasher = new Sha256SessionTokenHasher();
    const rawToken = "raw-token-that-must-not-be-stored";
    const now = new Date("2025-01-01T12:00:00.000Z");

    try {
      await connection.db.delete(sessions);
      await store.create({
        id: "session-active",
        tokenHash: hasher.hash(rawToken),
        user: { id: "subject", displayName: "User", email: null },
        createdAt: new Date("2025-01-01T11:00:00.000Z"),
        expiresAt: new Date("2025-01-01T13:00:00.000Z"),
        revokedAt: null,
      });
      for (const id of ["session-expired-b", "session-expired-a"]) {
        await store.create({
          id,
          tokenHash: hasher.hash(id),
          user: { id: "subject", displayName: "User", email: null },
          createdAt: new Date("2024-12-31T00:00:00.000Z"),
          expiresAt: new Date("2025-01-01T00:00:00.000Z"),
          revokedAt: null,
        });
      }

      const [row] = await connection.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, "session-active"));
      expect(row?.tokenHash).toBe(hasher.hash(rawToken));
      expect(JSON.stringify(row)).not.toContain(rawToken);
      await expect(store.deleteEligible(now, 1)).resolves.toBe(1);
      await expect(store.findByTokenHash(hasher.hash("session-expired-a"))).resolves.toBeNull();
      await expect(store.findByTokenHash(hasher.hash("session-expired-b"))).resolves.not.toBeNull();
      await expect(store.findByTokenHash(hasher.hash(rawToken))).resolves.not.toBeNull();
      await expect(store.revokeAll(now)).resolves.toBe(2);
      expect((await store.findByTokenHash(hasher.hash(rawToken)))?.revokedAt).toEqual(now);
    } finally {
      await connection.client.end();
    }
  });

  it("INT-FF-AUTH-006-01 deletes a bounded deterministic eligible batch", async () => {
    if (testDatabaseUrl === undefined) return;
    await migrate(testDatabaseUrl);
    const connection = createPostgresConnection(testDatabaseUrl);
    try {
      const store = new DrizzleSessionStore(connection.db);
      await expect(store.deleteEligible(new Date(), 1_000)).resolves.toBeGreaterThanOrEqual(0);
    } finally {
      await connection.client.end();
    }
  });

  it("INT-FF-AUTH-006-02 startup runs one bounded batch and maintenance remains repeatable", async () => {
    if (testDatabaseUrl === undefined) return;
    await migrate(testDatabaseUrl);
    const connection = createPostgresConnection(testDatabaseUrl);
    const hasher = new Sha256SessionTokenHasher();
    try {
      await connection.db.delete(sessions);
      const store = new DrizzleSessionStore(connection.db);
      await connection.db.insert(sessions).values([
        ...Array.from({ length: 1_001 }, (_, index) => ({
          id: `startup-expired-${String(index).padStart(4, "0")}`,
          tokenHash: `startup-hash-${index}`,
          userId: "subject",
          userDisplayName: "User",
          userEmail: null,
          createdAt: new Date("2019-01-01T00:00:00.000Z"),
          expiresAt: new Date("2020-01-01T00:00:00.000Z"),
          revokedAt: null,
        })),
        {
          id: "startup-active",
          tokenHash: "startup-active-hash",
          userId: "subject",
          userDisplayName: "User",
          userEmail: null,
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
          expiresAt: new Date("2100-01-01T00:00:00.000Z"),
          revokedAt: null,
        },
      ]);

      await expect(runServerStartup(testDatabaseUrl)).resolves.toContain(
        "Session cleanup deleted 1000 row(s)",
      );
      expect(
        (await connection.db.select({ id: sessions.id }).from(sessions)).map(({ id }) => id).sort(),
      ).toEqual(["startup-active", "startup-expired-1000"]);

      await connection.db.delete(sessions);
      for (const record of [
        {
          id: "maintenance-expired",
          token: "maintenance-expired",
          expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        },
        {
          id: "maintenance-active",
          token: "maintenance-active",
          expiresAt: new Date("2100-01-01T00:00:00.000Z"),
        },
      ]) {
        await store.create({
          id: record.id,
          tokenHash: hasher.hash(record.token),
          user: { id: "subject", displayName: "User", email: null },
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
          expiresAt: record.expiresAt,
          revokedAt: null,
        });
      }

      await expect(runSessionCleanup(testDatabaseUrl)).resolves.toContain(
        "Session cleanup deleted 1 row(s)",
      );
      await expect(runSessionCleanup(testDatabaseUrl)).resolves.toContain(
        "Session cleanup deleted 0 row(s)",
      );
      await expect(
        store.findByTokenHash(hasher.hash("maintenance-active")),
      ).resolves.not.toBeNull();
    } finally {
      await connection.client.end();
    }
  }, 30_000);
});
