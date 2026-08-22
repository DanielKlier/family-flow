import { describe, expect, it } from "vitest";

import { DrizzleOidcTransactionStore } from "../../src/adapters/db/drizzle-oidc-transaction-store.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { oidcTransactions } from "../../src/adapters/db/schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle OIDC transaction store", () => {
  it("INT-FF-AUTH-002-02 atomically consumes an unexpired state exactly once", async () => {
    if (testDatabaseUrl === undefined) return;
    await migrate(testDatabaseUrl);
    const connection = createPostgresConnection(testDatabaseUrl);
    const store = new DrizzleOidcTransactionStore(connection.db);
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const expiresAt = new Date("2025-01-01T00:10:00.000Z");

    try {
      await connection.db.delete(oidcTransactions);
      await store.create({
        id: "oidc-transaction-id",
        state: "opaque-state",
        nonce: "opaque-nonce",
        returnTo: "/transactions",
        createdAt,
        expiresAt,
        consumedAt: null,
      });

      const results = await Promise.all([
        store.consumeByState("opaque-state", new Date("2025-01-01T00:09:59.999Z")),
        store.consumeByState("opaque-state", new Date("2025-01-01T00:09:59.999Z")),
      ]);
      expect(results.filter((result) => result !== null)).toHaveLength(1);
      expect(results.filter((result) => result === null)).toHaveLength(1);
      await expect(
        store.consumeByState("opaque-state", new Date("2025-01-01T00:10:00.000Z")),
      ).resolves.toBeNull();
    } finally {
      await connection.client.end();
    }
  });
});
