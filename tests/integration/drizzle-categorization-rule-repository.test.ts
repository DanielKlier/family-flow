import { describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategorizationRuleRepository } from "../../src/adapters/db/drizzle-categorization-rule-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
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
      ownerContexts: new DrizzleOwnerContextRepository(connection.db),
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
        fixedCost: true,
        priority: 10,
        enabled: true,
      });

      await repositories.rules.save(rule);

      await expect(repositories.rules.list()).resolves.toEqual([rule]);
    } finally {
      await connection.client.end();
    }
  });

  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-CAT-002-02: round-trips mark, unmark, and unchanged transfer actions",
    async () => {
      if (testDatabaseUrl === undefined) {
        throw new Error("TEST_DATABASE_URL is required");
      }

      await migrate(testDatabaseUrl);
      const connection = createPostgresConnection(testDatabaseUrl);
      const repositories = {
        accounts: new DrizzleAccountRepository(connection.db),
        categories: new DrizzleCategoryRepository(connection.db),
        ownerContexts: new DrizzleOwnerContextRepository(connection.db),
        rules: new DrizzleCategorizationRuleRepository(connection.db),
      };

      try {
        await seedMasterData(repositories);
        const actions = [
          ["rule-mark-transfer", true],
          ["rule-unmark-transfer", false],
          ["rule-unchanged-transfer", null],
        ] as const;
        for (const [id, internalTransfer] of actions) {
          await repositories.rules.save(
            createCategorizationRule({
              id,
              name: id,
              searchText: "settlement",
              categoryId: "category-other",
              internalTransfer,
              priority: 1,
              enabled: true,
            }),
          );
        }

        expect(
          (await repositories.rules.list()).map(({ id, internalTransfer }) => ({
            id,
            internalTransfer,
          })),
        ).toEqual(
          actions
            .map(([id, internalTransfer]) => ({ id, internalTransfer }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        );
      } finally {
        await connection.client.end();
      }
    },
  );
});
