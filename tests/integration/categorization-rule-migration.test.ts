import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("categorization rule migration", () => {
  it("creates the categorization rules table with foreign keys", async () => {
    const migration = await readFile("drizzle/0006_categorization_rules.sql", "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS categorization_rules");
    expect(migration).toContain("category_id text NOT NULL REFERENCES categories(id)");
    expect(migration).toContain("account_id text REFERENCES accounts(id)");
  });
});
