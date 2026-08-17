import { describe, expect, it } from "vitest";

import { createGermanLocalization } from "../../src/adapters/localization/german.js";

import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategorizationRuleRepository } from "../../src/adapters/db/drizzle-categorization-rule-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { createCategorizationRule } from "../../src/core/categorization/categorization-rule.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const transferRuleIds = [
  "rule-mark-transfer",
  "rule-unmark-transfer",
  "rule-unchanged-transfer",
] as const;

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
      await seedMasterData(repositories, createGermanLocalization());
      await repositories.rules.delete("rule-groceries");
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

      await expect(repositories.rules.get(rule.id)).resolves.toEqual(rule);
    } finally {
      try {
        await repositories.rules.delete("rule-groceries");
      } finally {
        await connection.client.end();
      }
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
        await seedMasterData(repositories, createGermanLocalization());
        await Promise.all(transferRuleIds.map((id) => repositories.rules.delete(id)));
        const actions = [
          [transferRuleIds[0], true],
          [transferRuleIds[1], false],
          [transferRuleIds[2], null],
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

        await expect(
          Promise.all(
            actions.map(async ([id]) => {
              const rule = await repositories.rules.get(id);
              return rule === null
                ? null
                : { id: rule.id, internalTransfer: rule.internalTransfer };
            }),
          ),
        ).resolves.toEqual(actions.map(([id, internalTransfer]) => ({ id, internalTransfer })));
      } finally {
        try {
          await Promise.all(transferRuleIds.map((id) => repositories.rules.delete(id)));
        } finally {
          await connection.client.end();
        }
      }
    },
  );
});
