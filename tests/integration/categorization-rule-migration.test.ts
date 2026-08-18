import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createPostgresConnection } from "../../src/adapters/db/postgres.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe("categorization rule migration", () => {
  it("creates the categorization rules table with foreign keys", async () => {
    const migration = await readFile("drizzle/0006_categorization_rules.sql", "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS categorization_rules");
    expect(migration).toContain("category_id text NOT NULL REFERENCES categories(id)");
    expect(migration).toContain("account_id text REFERENCES accounts(id)");
  });

  it("adds the fixed-cost action column", async () => {
    const migration = await readFile("drizzle/0007_categorization_rule_fixed_cost.sql", "utf8");

    expect(migration).toContain(
      "ALTER TABLE categorization_rules ADD COLUMN IF NOT EXISTS fixed_cost boolean",
    );
  });

  it("INT-FF-CAT-002-03: adds a nullable internal-transfer action column", async () => {
    const migration = await readFile(
      "drizzle/0015_categorization_rule_internal_transfer.sql",
      "utf8",
    );

    expect(migration).toContain(
      "ALTER TABLE categorization_rules ADD COLUMN IF NOT EXISTS internal_transfer boolean",
    );
  });

  it("INT-FF-CAT-004-02 INT-FF-CAT-005-03: contains normalized collision diagnostics and protected historical origins", async () => {
    const migration = await readFile(
      "drizzle/0016_category_origin_and_normalized_names.sql",
      "utf8",
    );

    expect(migration).toContain("normalize(name, NFKC)");
    expect(migration).toContain("Historical normalized category collision");
    expect(migration).toContain("array_agg(id ORDER BY id)");
    expect(migration).toContain("WHEN source = 'manual' THEN 'manual'");
    expect(migration).toContain("WHEN source = 'csv' THEN 'legacy_preserved'");
    expect(migration).toContain("category_origin text NOT NULL");
    expect(migration).toContain("categories_normalized_name_unique_idx");
  });

  it.runIf(databaseUrl !== undefined)(
    "INT-FF-CAT-004-02: aborts on NFKC-normalized collisions before mutation",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      const connection = createPostgresConnection(databaseUrl);
      const migration = await readFile(
        "drizzle/0016_category_origin_and_normalized_names.sql",
        "utf8",
      );
      try {
        await expect(
          connection.client.begin(async (sql) => {
            await createLegacyFixtureTables(sql);
            await sql`insert into categories (id, name) values ('category-a', ' Ｆｏｏ '), ('category-b', 'foo')`;
            await sql.unsafe(migration);
          }),
        ).rejects.toThrow(/Historical normalized category collision.*category-a.*category-b/);
      } finally {
        await connection.client.end();
      }
    },
  );

  it.runIf(databaseUrl !== undefined)(
    "INT-FF-CAT-005-03: assigns non-destructive origins by historical source",
    async () => {
      if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      const connection = createPostgresConnection(databaseUrl);
      const migration = await readFile(
        "drizzle/0016_category_origin_and_normalized_names.sql",
        "utf8",
      );
      try {
        await connection.client.begin(async (sql) => {
          await createLegacyFixtureTables(sql);
          await sql`insert into categories (id, name) values ('category-a', ' Food ')`;
          await sql`insert into transactions (id, source, category_id) values ('manual-row', 'manual', 'category-a'), ('csv-row', 'csv', 'category-a')`;
          await sql`insert into import_preview_batches (id, consumed_at) values ('active', null), ('consumed', now())`;
          await sql.unsafe(migration);

          expect(
            await sql<
              { id: string; category_origin: string }[]
            >`select id, category_origin from transactions order by id`,
          ).toEqual([
            { id: "csv-row", category_origin: "legacy_preserved" },
            { id: "manual-row", category_origin: "manual" },
          ]);
          expect(
            await sql<{ normalized_name: string }[]>`select normalized_name from categories`,
          ).toEqual([{ normalized_name: "food" }]);
          expect(
            await sql<{ id: string }[]>`select id from import_preview_batches order by id`,
          ).toEqual([{ id: "consumed" }]);
        });
      } finally {
        await connection.client.end();
      }
    },
  );
});

async function createLegacyFixtureTables(sql: {
  unsafe(query: string): Promise<unknown>;
}): Promise<void> {
  await sql.unsafe(`
    CREATE TEMP TABLE categories (id text PRIMARY KEY, name text NOT NULL);
    CREATE TEMP TABLE transactions (id text PRIMARY KEY, source text NOT NULL, category_id text NOT NULL);
    CREATE TEMP TABLE import_preview_batches (id text PRIMARY KEY, consumed_at timestamptz);
  `);
}
