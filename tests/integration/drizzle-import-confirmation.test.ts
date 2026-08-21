import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleImportPreviewBatchRepository } from "../../src/adapters/db/drizzle-import-preview-batch-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { DrizzleTransactionRepository } from "../../src/adapters/db/drizzle-transaction-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { importPreviewBatches, transactions } from "../../src/adapters/db/schema.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { confirmCsvImportBatch } from "../../src/core/imports/confirm-csv-import.js";
import {
  createImportHash,
  createImportHashCandidates,
  detectDuplicateImportRows,
} from "../../src/core/imports/csv-import.js";
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

function outcome(
  id: string,
  hash: string,
  categoryId = "category-other",
  purpose = "Purpose",
  description = id,
) {
  return {
    line: 2,
    outcome: "importable" as const,
    reason: null,
    transaction: {
      id,
      accountId: "account-shared-checking",
      categoryId,
      categoryOrigin: "fallback" as const,
      date: "2026-07-15",
      amountCents: -100,
      description,
      payee: null,
      purpose,
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
        await seedMasterData(
          {
            accounts: new DrizzleAccountRepository(connection.db),
            categories: new DrizzleCategoryRepository(connection.db),
            ownerContexts: new DrizzleOwnerContextRepository(connection.db),
          },
          createGermanLocalization(),
        );
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
    "INT-FF-CSV-012-04: persists distinct-purpose v3 identities and uses database-loaded purposes for v1/v2 compatibility",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(databaseUrl);
      const connection = createPostgresConnection(databaseUrl);
      const repository = new DrizzleImportPreviewBatchRepository(connection.db);
      const transactionRepository = new DrizzleTransactionRepository(connection.db);
      const batchIds: string[] = [];
      const importHash = (purpose: string) =>
        createImportHash({
          accountId: "account-shared-checking",
          date: "2026-07-15",
          amountCents: -100,
          description: "Same payment",
          payee: "Shop",
          purpose,
        });
      try {
        await seedMasterData(
          {
            accounts: new DrizzleAccountRepository(connection.db),
            categories: new DrizzleCategoryRepository(connection.db),
            ownerContexts: new DrizzleOwnerContextRepository(connection.db),
          },
          createGermanLocalization(),
        );
        const januaryHash = importHash("January groceries");
        const februaryHash = importHash("February groceries");
        expect(januaryHash).toMatch(/^v3:[a-f0-9]{64}$/);
        expect(februaryHash).not.toBe(januaryHash);
        for (const [hash, purpose] of [
          [januaryHash, "January groceries"],
          [februaryHash, "February groceries"],
        ] as const) {
          const id = randomUUID();
          batchIds.push(id);
          await repository.save({
            id,
            userId: "user",
            accountId: "account-shared-checking",
            createdAt: now,
            expiresAt: new Date(now.getTime() + 60_000),
            profileSnapshot: profile,
            outcomes: [outcome(randomUUID(), hash, "category-other", purpose, "Same payment")],
          });
          await confirmCsvImportBatch({
            batchId: id,
            userId: "user",
            now,
            persistence: repository,
          });
        }
        await expect(
          connection.db
            .select()
            .from(transactions)
            .where(eq(transactions.description, "Same payment")),
        ).resolves.toHaveLength(2);

        const concurrentHash = importHash("Concurrent groceries");
        const concurrentBatches = [randomUUID(), randomUUID()];
        batchIds.push(...concurrentBatches);
        for (const id of concurrentBatches)
          await repository.save({
            id,
            userId: "user",
            accountId: "account-shared-checking",
            createdAt: now,
            expiresAt: new Date(now.getTime() + 60_000),
            profileSnapshot: profile,
            outcomes: [
              outcome(randomUUID(), concurrentHash, "category-other", "Concurrent groceries"),
            ],
          });
        await Promise.all(
          concurrentBatches.map((batchId) =>
            confirmCsvImportBatch({ batchId, userId: "user", now, persistence: repository }),
          ),
        );
        await expect(
          connection.db
            .select()
            .from(transactions)
            .where(eq(transactions.importHash, concurrentHash)),
        ).resolves.toHaveLength(1);

        const historicalHashes = [
          ...createImportHashCandidates({
            accountId: "account-shared-checking",
            date: "2026-07-15",
            amountCents: -100,
            description: "Same payment",
            payee: "Shop",
            purpose: "January groceries",
          }),
        ].filter((hash) => !hash.startsWith("v3:"));
        expect(historicalHashes).toHaveLength(2);
        for (const hash of historicalHashes) {
          await connection.db.insert(transactions).values({
            id: randomUUID(),
            accountId: "account-shared-checking",
            categoryId: "category-other",
            categoryOrigin: "fallback",
            date: "2026-07-15",
            amountCents: -100,
            description: "Same payment",
            payee: "Shop",
            purpose: "January groceries",
            source: "csv",
            status: "booked",
            fixedCost: false,
            note: null,
            importHash: hash,
          });
          const existing = (await transactionRepository.list({})).filter(
            (transaction) => transaction.importHash === hash,
          );
          expect(
            detectDuplicateImportRows(
              [
                {
                  accountId: "account-shared-checking",
                  date: "2026-07-15",
                  amountCents: -100,
                  description: "Same payment",
                  payee: "Shop",
                  purpose: "January groceries",
                },
                {
                  accountId: "account-shared-checking",
                  date: "2026-07-15",
                  amountCents: -100,
                  description: "Same payment",
                  payee: "Shop",
                  purpose: "February groceries",
                },
              ],
              existing,
            ).map((row) => row.duplicate),
          ).toEqual([true, false]);
        }
      } finally {
        await connection.db
          .delete(transactions)
          .where(eq(transactions.accountId, "account-shared-checking"));
        for (const id of batchIds)
          await connection.db.delete(importPreviewBatches).where(eq(importPreviewBatches.id, id));
        await connection.client.end();
      }
    },
  );

  it.runIf(databaseUrl !== undefined)(
    "INT-FF-CSV-008-02 INT-FF-CSV-009-01 INT-FF-CSV-009-02: consumes and inserts atomically under failure and concurrency",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(databaseUrl);
      const connection = createPostgresConnection(databaseUrl);
      const repository = new DrizzleImportPreviewBatchRepository(connection.db);
      const ids: string[] = [];
      try {
        await seedMasterData(
          {
            accounts: new DrizzleAccountRepository(connection.db),
            categories: new DrizzleCategoryRepository(connection.db),
            ownerContexts: new DrizzleOwnerContextRepository(connection.db),
          },
          createGermanLocalization(),
        );
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
          categoryOrigin: "legacy_preserved",
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
