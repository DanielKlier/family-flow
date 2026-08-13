import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

async function insertImported(
  sql: ReturnType<typeof createPostgresConnection>["client"],
  id: string,
  hash: string,
) {
  await sql`insert into transactions (id, account_id, category_id, date, amount_cents, description, source, status, fixed_cost, import_hash) values (${id}, 'account-shared-checking', 'category-other', '2026-07-15', -100, ${id}, 'csv', 'booked', false, ${hash})`;
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
    "INT-FF-CSV-010-01/010-02: aborts without rewriting malformed hashes or collisions",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(databaseUrl);
      const connection = createPostgresConnection(databaseUrl);
      const sql = connection.client;
      const migration = await readFile("drizzle/0012_csv_security_atomicity.sql", "utf8");
      try {
        await seedMasterData({
          accounts: new DrizzleAccountRepository(connection.db),
          categories: new DrizzleCategoryRepository(connection.db),
          ownerContexts: new DrizzleOwnerContextRepository(connection.db),
        });
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
