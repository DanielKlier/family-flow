import { describe, expect, it } from "vitest";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategorizationRuleRepository } from "../../src/adapters/db/drizzle-categorization-rule-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { createCategorizationRule } from "../../src/core/categorization/categorization-rule.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const transferRuleIds = [
  "rule-mark-transfer",
  "rule-unmark-transfer",
  "rule-unchanged-transfer",
] as const;

describe("Drizzle categorization rule repository", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-CAT-003-01: stores and lists equal-priority rules in code-point ID order",
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
      const tieIds = ["rule-a", "rule-A", "rule-!", "rule-_", "rule-groceries"];

      try {
        await seedMasterData(repositories, createGermanLocalization());
        await Promise.all(tieIds.map((id) => repositories.rules.delete(id)));
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

        for (const id of tieIds) {
          await repositories.rules.save(
            id === rule.id
              ? rule
              : createCategorizationRule({
                  ...rule,
                  id,
                  name: `${id} display name`,
                }),
          );
        }

        await expect(repositories.rules.get(rule.id)).resolves.toEqual(rule);
        expect(
          (await repositories.rules.list())
            .filter(({ id }) => tieIds.includes(id))
            .map(({ id }) => id),
        ).toEqual(["rule-!", "rule-A", "rule-_", "rule-a", "rule-groceries"]);
      } finally {
        try {
          await Promise.all(tieIds.map((id) => repositories.rules.delete(id)));
        } finally {
          await connection.client.end();
        }
      }
    },
  );

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
