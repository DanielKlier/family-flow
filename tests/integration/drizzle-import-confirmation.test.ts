import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleImportPreviewBatchRepository } from "../../src/adapters/db/drizzle-import-preview-batch-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { importPreviewBatches, transactions } from "../../src/adapters/db/schema.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { confirmCsvImportBatch } from "../../src/core/imports/confirm-csv-import.js";
import { createImportProfile } from "../../src/core/imports/import-profile.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const now = new Date("2026-07-15T10:00:00.000Z");
const profile = createImportProfile({
  id: "snapshot",
  name: "Snapshot",
  kind: "custom",
  delimiter: ";",
  encoding: "utf8",
  dateColumn: "Date",
  amountColumn: "Amount",
  descriptionColumn: "Description",
});

function outcome(id: string, hash: string, categoryId = "category-other") {
  return {
    line: 2,
    outcome: "importable" as const,
    reason: null,
    transaction: {
      id,
      accountId: "account-shared-checking",
      categoryId,
      date: "2026-07-15",
      amountCents: -100,
      description: id,
      payee: null,
      purpose: "Purpose",
      importHash: hash,
    },
  };
}

describe("PostgreSQL CSV confirmation", () => {
  it.runIf(databaseUrl !== undefined)(
    "rejects stored outcome snapshots without complete canonical metadata",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(databaseUrl);
      const connection = createPostgresConnection(databaseUrl);
      const repository = new DrizzleImportPreviewBatchRepository(connection.db);
      const batchId = randomUUID();
      try {
        await seedMasterData({
          accounts: new DrizzleAccountRepository(connection.db),
          categories: new DrizzleCategoryRepository(connection.db),
          ownerContexts: new DrizzleOwnerContextRepository(connection.db),
        });
        await connection.db.insert(importPreviewBatches).values({
          id: batchId,
          userId: "user",
          accountId: "account-shared-checking",
          createdAt: now,
          expiresAt: new Date(now.getTime() + 60_000),
          profileSnapshot: profile,
          outcomeSnapshot: [{ outcome: "ignored", reason: "amount-not-negative" }],
        });

        await expect(
          repository.withinTransaction(() =>
            repository.consumePreviewBatch({ batchId, userId: "user", now }),
          ),
        ).rejects.toThrow("Import outcome snapshot is invalid");
      } finally {
        await connection.db
          .delete(importPreviewBatches)
          .where(eq(importPreviewBatches.id, batchId));
        await connection.client.end();
      }
    },
  );

  it.runIf(databaseUrl !== undefined)(
    "INT-FF-CSV-008-02/009-01/009-02: consumes and inserts atomically under failure and concurrency",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(databaseUrl);
      const connection = createPostgresConnection(databaseUrl);
      const repository = new DrizzleImportPreviewBatchRepository(connection.db);
      const ids: string[] = [];
      try {
        await seedMasterData({
          accounts: new DrizzleAccountRepository(connection.db),
          categories: new DrizzleCategoryRepository(connection.db),
          ownerContexts: new DrizzleOwnerContextRepository(connection.db),
        });
        const failedBatch = randomUUID();
        ids.push(failedBatch);
        await repository.save({
          id: failedBatch,
          userId: "user",
          accountId: "account-shared-checking",
          createdAt: now,
          expiresAt: new Date(now.getTime() + 60_000),
          profileSnapshot: profile,
          outcomes: [
            outcome(randomUUID(), `v2:${"a".repeat(64)}`),
            outcome(randomUUID(), `v2:${"b".repeat(64)}`, "missing-category"),
          ],
        });
        await expect(
          confirmCsvImportBatch({
            batchId: failedBatch,
            userId: "user",
            now,
            persistence: repository,
          }),
        ).rejects.toThrow();
        await expect(
          connection.db
            .select()
            .from(transactions)
            .where(eq(transactions.importHash, `v2:${"a".repeat(64)}`)),
        ).resolves.toHaveLength(0);
        const [failed] = await connection.db
          .select()
          .from(importPreviewBatches)
          .where(eq(importPreviewBatches.id, failedBatch));
        expect(failed?.consumedAt).toBeNull();

        const conflictHash = `v2:${"f".repeat(64)}`;
        await connection.db.insert(transactions).values({
          id: "existing-import-conflict",
          accountId: "account-shared-checking",
          categoryId: "category-other",
          date: "2026-07-15",
          amountCents: -100,
          description: "Existing",
          payee: null,
          purpose: null,
          source: "csv",
          status: "booked",
          fixedCost: false,
          note: null,
          importHash: conflictHash,
        });
        const partialBatch = randomUUID();
        ids.push(partialBatch);
        const newHash = `v2:${"9".repeat(64)}`;
        await repository.save({
          id: partialBatch,
          userId: "user",
          accountId: "account-shared-checking",
          createdAt: now,
          expiresAt: new Date(now.getTime() + 60_000),
          profileSnapshot: profile,
          outcomes: [outcome(randomUUID(), conflictHash), outcome(randomUUID(), newHash)],
        });
        await expect(
          confirmCsvImportBatch({
            batchId: partialBatch,
            userId: "user",
            now,
            persistence: repository,
          }),
        ).rejects.toThrow("partial import conflict");
        await expect(
          connection.db.select().from(transactions).where(eq(transactions.importHash, newHash)),
        ).resolves.toHaveLength(0);
        const [partial] = await connection.db
          .select()
          .from(importPreviewBatches)
          .where(eq(importPreviewBatches.id, partialBatch));
        expect(partial?.consumedAt).toBeNull();

        const hash = `v2:${"c".repeat(64)}`;
        const batches = [randomUUID(), randomUUID()];
        ids.push(...batches);
        for (const id of batches)
          await repository.save({
            id,
            userId: "user",
            accountId: "account-shared-checking",
            createdAt: now,
            expiresAt: new Date(now.getTime() + 60_000),
            profileSnapshot: profile,
            outcomes: [outcome(randomUUID(), hash)],
          });
        await expect(
          Promise.all(
            batches.map((batchId) =>
              confirmCsvImportBatch({ batchId, userId: "user", now, persistence: repository }),
            ),
          ),
        ).resolves.toHaveLength(2);
        await expect(
          connection.db.select().from(transactions).where(eq(transactions.importHash, hash)),
        ).resolves.toHaveLength(1);
      } finally {
        await connection.db
          .delete(transactions)
          .where(eq(transactions.accountId, "account-shared-checking"));
        for (const id of ids)
          await connection.db.delete(importPreviewBatches).where(eq(importPreviewBatches.id, id));
        await connection.client.end();
      }
    },
  );
});
