import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { Sha256SessionTokenHasher } from "../../src/adapters/auth/session-cryptography.js";
import { DrizzleSessionStore } from "../../src/adapters/db/drizzle-session-store.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { sessions } from "../../src/adapters/db/schema.js";
import { buildServer } from "../../src/app/server.js";
import { SessionService } from "../../src/core/auth/session-service.js";
import type { Clock } from "../../src/ports/clock/clock.js";
import type { RequestLogEntry, RequestLogger } from "../../src/ports/logging/logger.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const token = "a".repeat(43);
const hasher = new Sha256SessionTokenHasher();

class CapturingLogger implements RequestLogger {
  readonly entries: RequestLogEntry[] = [];

  logRequest(entry: RequestLogEntry): void {
    this.entries.push(entry);
  }
}

class ControlledClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(value: Date): void {
    this.current = value;
  }
}

const tokenGenerator = {
  generate: () => token,
  generateId: () => "00000000-0000-4000-8000-000000000001",
};

async function withPostgresServer(
  baseUrl: string,
  clock: ControlledClock,
  run: (context: {
    server: ReturnType<typeof buildServer>;
    connection: ReturnType<typeof createPostgresConnection>;
    store: DrizzleSessionStore;
    logger: CapturingLogger;
  }) => Promise<void>,
): Promise<void> {
  if (testDatabaseUrl === undefined) return;
  await migrate(testDatabaseUrl);
  const connection = createPostgresConnection(testDatabaseUrl);
  const store = new DrizzleSessionStore(connection.db);
  await connection.db.delete(sessions);
  const service = new SessionService(store, clock, tokenGenerator, hasher);
  const logger = new CapturingLogger();
  const server = buildServer({
    auth: { mode: "test", baseUrl, oidc: null },
    sessions: service,
    logger,
  });

  try {
    await run({ server, connection, store, logger });
  } finally {
    await server.close();
    await connection.client.end();
  }
}

function sessionCookie(response: Awaited<ReturnType<ReturnType<typeof buildServer>["inject"]>>) {
  const cookie = response.cookies.find(({ name }) => name === "ff_session");
  expect(cookie).toBeDefined();
  return cookie;
}

describe("PostgreSQL-backed HTTP session handling", () => {
  it.each([
    ["http://127.0.0.1:3000", false],
    ["https://finances.home.arpa", true],
  ])("INT-FF-AUTH-007-01 sets the complete cookie contract for %s", async (baseUrl, secure) => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    await withPostgresServer(baseUrl, new ControlledClock(now), async ({ server }) => {
      const response = await server.inject({ method: "GET", url: "/auth/test-login?returnTo=/" });

      expect(response.statusCode).toBe(302);
      expect(sessionCookie(response)).toEqual(
        expect.objectContaining({
          name: "ff_session",
          value: token,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          maxAge: 28_800,
          expires: new Date("2025-01-01T08:00:00.000Z"),
        }),
      );
      expect(sessionCookie(response)?.secure).toBe(secure ? true : undefined);
    });
  });

  it("INT-FF-AUTH-003-02 INT-FF-AUTH-004-01 resolves active sessions and rejects unknown, exactly expired, and revoked sessions", async () => {
    const clock = new ControlledClock(new Date("2025-01-01T00:00:00.000Z"));
    await withPostgresServer(
      "http://127.0.0.1:3000",
      clock,
      async ({ server, store, connection, logger }) => {
        const login = await server.inject({ method: "GET", url: "/auth/test-login" });
        const cookieHeader = `ff_session=${sessionCookie(login)?.value ?? ""}`;
        const [persisted] = await connection.db.select().from(sessions);
        expect(persisted?.tokenHash).toBe(hasher.hash(token));
        expect(JSON.stringify(persisted)).not.toContain(token);
        const protectedRequest = () =>
          server.inject({ method: "GET", url: "/transactions", headers: { cookie: cookieHeader } });

        expect((await protectedRequest()).statusCode).toBe(200);
        expect(JSON.stringify(logger.entries)).not.toContain(token);
        expect(
          (
            await server.inject({
              method: "GET",
              url: "/transactions",
              headers: { cookie: "ff_session=unknown" },
            })
          ).statusCode,
        ).toBe(302);

        clock.set(new Date("2025-01-01T08:00:00.000Z"));
        expect((await protectedRequest()).statusCode).toBe(302);

        clock.set(new Date("2025-01-01T07:59:59.000Z"));
        await store.revoke(hasher.hash(token), clock.now());
        expect((await protectedRequest()).statusCode).toBe(302);
      },
    );
  });

  it("INT-FF-AUTH-004-02 preserves the absolute eight-hour expiry without sliding", async () => {
    const clock = new ControlledClock(new Date("2025-01-01T00:00:00.000Z"));
    await withPostgresServer("http://127.0.0.1:3000", clock, async ({ server, connection }) => {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const cookieHeader = `ff_session=${sessionCookie(login)?.value ?? ""}`;
      clock.set(new Date("2025-01-01T07:00:00.000Z"));

      expect(
        (
          await server.inject({
            method: "GET",
            url: "/transactions",
            headers: { cookie: cookieHeader },
          })
        ).statusCode,
      ).toBe(200);
      const [persisted] = await connection.db
        .select()
        .from(sessions)
        .where(eq(sessions.tokenHash, hasher.hash(token)));
      expect(persisted?.createdAt).toEqual(new Date("2025-01-01T00:00:00.000Z"));
      expect(persisted?.expiresAt).toEqual(new Date("2025-01-01T08:00:00.000Z"));
    });
  });

  it("INT-FF-AUTH-005-01 persists logout revocation before rejecting token replay", async () => {
    const clock = new ControlledClock(new Date("2025-01-01T00:00:00.000Z"));
    await withPostgresServer("http://127.0.0.1:3000", clock, async ({ server, connection }) => {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const cookieHeader = `ff_session=${sessionCookie(login)?.value ?? ""}`;
      clock.set(new Date("2025-01-01T01:00:00.000Z"));

      const logout = await server.inject({
        method: "POST",
        url: "/auth/logout",
        headers: { cookie: cookieHeader, origin: "http://127.0.0.1:3000" },
      });
      expect(logout.statusCode).toBe(302);
      const [persisted] = await connection.db
        .select()
        .from(sessions)
        .where(eq(sessions.tokenHash, hasher.hash(token)));
      expect(persisted?.revokedAt).toEqual(new Date("2025-01-01T01:00:00.000Z"));
      expect(
        (
          await server.inject({
            method: "GET",
            url: "/transactions",
            headers: { cookie: cookieHeader },
          })
        ).statusCode,
      ).toBe(302);
    });
  });
});
