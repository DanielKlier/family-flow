import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

async function insertImported(
  sql: ReturnType<typeof createPostgresConnection>["client"],
  id: string,
  hash: string,
) {
  await sql`insert into transactions (id, account_id, category_id, category_origin, date, amount_cents, description, source, status, fixed_cost, import_hash) values (${id}, 'account-shared-checking', 'category-other', 'legacy_preserved', '2026-07-15', -100, ${id}, 'csv', 'booked', false, ${hash})`;
}

describe("CSV import hash migration", () => {
  it.runIf(databaseUrl !== undefined)(
    "aborts with every invalid historical profile ID and remediation guidance",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(databaseUrl);
      const connection = createPostgresConnection(databaseUrl);
      const sql = connection.client;
      const migration = await readFile("drizzle/0012_csv_security_atomicity.sql", "utf8");
      const ids = ["migration-profile-bad-delimiter", "migration-profile-bad-encoding"];
      try {
        await sql`delete from import_profiles where id in (${ids[0]}, ${ids[1]})`;
        await sql`insert into import_profiles (id, name, kind, delimiter, encoding, date_column, amount_column, description_column) values (${ids[0]}, 'Bad delimiter', 'custom', '|', 'utf8', 'Date', 'Amount', 'Description'), (${ids[1]}, 'Bad encoding', 'custom', ';', 'cp1252', 'Date', 'Amount', 'Description')`;

        await expect(sql.unsafe(migration)).rejects.toThrow(
          /migration-profile-bad-delimiter,migration-profile-bad-encoding.*runbook=OPERATIONS.md#csv-import-problems.*remediation=/,
        );
        const rows = await sql<
          { id: string; delimiter: string; encoding: string }[]
        >`select id, delimiter, encoding from import_profiles where id in (${ids[0]}, ${ids[1]}) order by id`;
        expect(rows).toEqual([
          { id: ids[0], delimiter: "|", encoding: "utf8" },
          { id: ids[1], delimiter: ";", encoding: "cp1252" },
        ]);
      } finally {
        await sql`delete from import_profiles where id in (${ids[0]}, ${ids[1]})`;
        await connection.client.end();
      }
    },
  );

  it.runIf(databaseUrl !== undefined)(
    "INT-FF-CSV-012-03: validates v1/v2/v3 without rewriting financial records and invalidates only active previews",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(databaseUrl);
      const connection = createPostgresConnection(databaseUrl);
      const sql = connection.client;
      const migration = await readFile("drizzle/0013_csv_import_purpose_identity.sql", "utf8");
      const ids = [
        "migration-v1",
        "migration-v2",
        "migration-v3",
        "migration-malformed-0013",
        "migration-collision-0013-a",
        "migration-collision-0013-b",
      ];
      const batches = ["migration-active-0013", "migration-consumed-0013"];
      try {
        await seedMasterData(
          {
            accounts: new DrizzleAccountRepository(connection.db),
            categories: new DrizzleCategoryRepository(connection.db),
            ownerContexts: new DrizzleOwnerContextRepository(connection.db),
          },
          createGermanLocalization(),
        );
        await sql`drop index if exists transactions_account_import_hash_unique_idx`;
        await insertImported(sql, ids[0], "a".repeat(64));
        await insertImported(sql, ids[1], `v2:${"b".repeat(64)}`);
        await insertImported(sql, ids[2], `v3:${"c".repeat(64)}`);
        await sql`insert into import_preview_batches (id, user_id, account_id, created_at, expires_at, consumed_at, profile_snapshot, outcome_snapshot) values (${batches[0]}, 'user', 'account-shared-checking', now(), now(), null, '{}'::jsonb, '{}'::jsonb), (${batches[1]}, 'user', 'account-shared-checking', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)`;

        await insertImported(sql, ids[3], "v3:malformed");
        await expect(sql.unsafe(migration)).rejects.toThrow(/migration-malformed-0013/);
        expect(
          await sql<
            { import_hash: string }[]
          >`select import_hash from transactions where id = ${ids[3]}`,
        ).toEqual([{ import_hash: "v3:malformed" }]);
        await expect(
          sql<{ id: string }[]>`select id from import_preview_batches where id = ${batches[0]}`,
        ).resolves.toHaveLength(1);
        await sql`delete from transactions where id = ${ids[3]}`;

        const collisionHash = `v3:${"f".repeat(64)}`;
        await insertImported(sql, ids[4], collisionHash);
        await insertImported(sql, ids[5], collisionHash);
        await expect(sql.unsafe(migration)).rejects.toThrow(
          /migration-collision-0013-a,migration-collision-0013-b/,
        );
        expect(
          await sql<
            { import_hash: string }[]
          >`select import_hash from transactions where id in (${ids[4]}, ${ids[5]}) order by id`,
        ).toEqual([{ import_hash: collisionHash }, { import_hash: collisionHash }]);
        await expect(
          sql<{ id: string }[]>`select id from import_preview_batches where id = ${batches[0]}`,
        ).resolves.toHaveLength(1);
        await sql`delete from transactions where id in (${ids[4]}, ${ids[5]})`;

        const before = await sql<
          { id: string; import_hash: string }[]
        >`select id, import_hash from transactions where id in (${ids[0]}, ${ids[1]}, ${ids[2]}) order by id`;
        await sql.unsafe(migration);
        expect(
          await sql<
            { id: string; import_hash: string }[]
          >`select id, import_hash from transactions where id in (${ids[0]}, ${ids[1]}, ${ids[2]}) order by id`,
        ).toEqual(before);
        await expect(
          sql<{ id: string }[]>`select id from import_preview_batches where id = ${batches[0]}`,
        ).resolves.toHaveLength(0);
        await expect(
          sql<{ id: string }[]>`select id from import_preview_batches where id = ${batches[1]}`,
        ).resolves.toHaveLength(1);
      } finally {
        await sql`delete from import_preview_batches where id in (${batches[0]}, ${batches[1]})`;
        await sql`delete from transactions where id in (${ids[0]}, ${ids[1]}, ${ids[2]}, ${ids[3]}, ${ids[4]}, ${ids[5]})`;
        await sql`create unique index if not exists transactions_account_import_hash_unique_idx on transactions(account_id, import_hash) where import_hash is not null`;
        await connection.client.end();
      }
    },
  );

  it.runIf(databaseUrl !== undefined)(
    "INT-FF-CSV-010-01 INT-FF-CSV-010-02: aborts without rewriting malformed hashes or collisions",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(databaseUrl);
      const connection = createPostgresConnection(databaseUrl);
      const sql = connection.client;
      const migration = await readFile("drizzle/0012_csv_security_atomicity.sql", "utf8");
      try {
        await seedMasterData(
          {
            accounts: new DrizzleAccountRepository(connection.db),
            categories: new DrizzleCategoryRepository(connection.db),
            ownerContexts: new DrizzleOwnerContextRepository(connection.db),
          },
          createGermanLocalization(),
        );
        await sql`drop index if exists transactions_account_import_hash_unique_idx`;
        await insertImported(sql, "migration-malformed", "V2:not-lowercase");
        await expect(sql.unsafe(migration)).rejects.toThrow(
          /account-shared-checking.*V2:not-lowercase.*migration-malformed/,
        );
        const [malformed] = await sql<
          { import_hash: string }[]
        >`select import_hash from transactions where id = 'migration-malformed'`;
        expect(malformed?.import_hash).toBe("V2:not-lowercase");
        await sql`delete from transactions where id = 'migration-malformed'`;

        const hash = "e".repeat(64);
        await insertImported(sql, "migration-collision-a", hash);
        await insertImported(sql, "migration-collision-b", hash);
        await expect(sql.unsafe(migration)).rejects.toThrow(
          /migration-collision-a,migration-collision-b/,
        );
        const rows = await sql<
          { import_hash: string }[]
        >`select import_hash from transactions where id in ('migration-collision-a', 'migration-collision-b') order by id`;
        expect(rows.map((row) => row.import_hash)).toEqual([hash, hash]);
      } finally {
        await sql`delete from transactions where id in ('migration-malformed', 'migration-collision-a', 'migration-collision-b')`;
        await sql`create unique index if not exists transactions_account_import_hash_unique_idx on transactions(account_id, import_hash) where import_hash is not null`;
        await connection.client.end();
      }
    },
  );
});
