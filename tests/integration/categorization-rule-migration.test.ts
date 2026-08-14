import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

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
});
