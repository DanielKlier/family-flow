import { describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategorizationRuleRepository } from "../../src/adapters/db/drizzle-categorization-rule-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { createCategorizationRule } from "../../src/core/categorization/categorization-rule.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle categorization rule repository", () => {
  it.runIf(testDatabaseUrl !== undefined)("stores and lists categorization rules", async () => {
    if (testDatabaseUrl === undefined) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    await migrate(testDatabaseUrl);

    const connection = createPostgresConnection(testDatabaseUrl);
    const repositories = {
      accounts: new DrizzleAccountRepository(connection.db),
      categories: new DrizzleCategoryRepository(connection.db),
      rules: new DrizzleCategorizationRuleRepository(connection.db),
    };

    try {
      await seedMasterData(repositories);
      const rule = createCategorizationRule({
        id: "rule-groceries",
        name: "Groceries",
        searchText: "supermarket",
        categoryId: "category-groceries",
        accountId: "account-shared-checking",
        priority: 10,
        enabled: true,
      });

      await repositories.rules.save(rule);

      await expect(repositories.rules.list()).resolves.toEqual([rule]);
    } finally {
      await connection.client.end();
    }
  });
});
