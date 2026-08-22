import { describe, expect, it } from "vitest";
import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import {
  createInitialAccounts,
  createInitialCategories,
  createInitialOwnerContexts,
  seedMasterData,
} from "../../src/adapters/db/seeds/master-data.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle master data repositories", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-MDM-002-01 migrates an empty schema and preserves user-edited German master data on reseed",
    async () => {
      if (testDatabaseUrl === undefined) {
        throw new Error("TEST_DATABASE_URL is required");
      }

      const connection = createPostgresConnection(testDatabaseUrl);
      const repositories = {
        accounts: new DrizzleAccountRepository(connection.db),
        categories: new DrizzleCategoryRepository(connection.db),
        ownerContexts: new DrizzleOwnerContextRepository(connection.db),
      };
      const localization = createGermanLocalization();

      try {
        await connection.client.unsafe("drop schema public cascade; create schema public;");
        await migrate(testDatabaseUrl);
        await seedMasterData(repositories, localization);

        const account = await repositories.accounts.get("account-person-a-checking");
        if (account === null) throw new Error("Seeded account must exist");
        await repositories.accounts.save({ ...account, name: "User-defined account name" });
        await repositories.ownerContexts.save({
          ownerContext: "shared",
          label: "User-defined owner label",
        });

        await migrate(testDatabaseUrl);
        await seedMasterData(repositories, localization);

        await expect(repositories.accounts.list()).resolves.toEqual(
          expect.arrayContaining(
            createInitialAccounts(localization).map((seed) =>
              seed.id === account.id ? { ...seed, name: "User-defined account name" } : seed,
            ),
          ),
        );
        await expect(repositories.categories.list()).resolves.toEqual(
          expect.arrayContaining(createInitialCategories(localization)),
        );
        await expect(repositories.ownerContexts.list()).resolves.toEqual(
          expect.arrayContaining(
            createInitialOwnerContexts(localization).map((seed) =>
              seed.ownerContext === "shared"
                ? { ...seed, label: "User-defined owner label" }
                : seed,
            ),
          ),
        );
      } finally {
        await connection.client.end();
      }
    },
  );

  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-MDM-002-02 stores German fresh seeds without renaming existing master data",
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
      };

      try {
        await connection.client.unsafe(`
          delete from owner_context_labels
          where owner_context in ('person_a', 'person_b', 'shared');
          delete from accounts
          where id in ('account-person-a-checking', 'account-person-b-checking', 'account-shared-checking');
          delete from categories
          where id in (
            'category-housing-rent', 'category-groceries', 'category-drugstore',
            'category-insurance', 'category-mobility', 'category-health',
            'category-child-baby', 'category-subscriptions', 'category-leisure',
            'category-vacation', 'category-clothing', 'category-other'
          );
        `);
        await seedMasterData(repositories, createGermanLocalization());

        await expect(repositories.accounts.list()).resolves.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "account-person-a-checking",
              name: "Girokonto Person A",
            }),
            expect.objectContaining({
              id: "account-person-b-checking",
              name: "Girokonto Person B",
            }),
            expect.objectContaining({
              id: "account-shared-checking",
              name: "Gemeinsames Girokonto",
            }),
          ]),
        );
        await expect(repositories.ownerContexts.list()).resolves.toEqual([
          { ownerContext: "person_a", label: "Person A" },
          { ownerContext: "person_b", label: "Person B" },
          { ownerContext: "shared", label: "Gemeinsam" },
        ]);
        await expect(repositories.categories.list()).resolves.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "category-housing-rent", name: "Wohnen/Miete" }),
            expect.objectContaining({ id: "category-groceries", name: "Lebensmittel" }),
            expect.objectContaining({ id: "category-other", name: "Sonstiges" }),
          ]),
        );

        const account = await repositories.accounts.get("account-person-a-checking");
        if (account === null) throw new Error("Seeded account must exist");
        await repositories.accounts.save({ ...account, name: "User-defined account name" });
        await repositories.ownerContexts.save({
          ownerContext: "shared",
          label: "User-defined owner label",
        });
        await seedMasterData(repositories, createGermanLocalization());
        await expect(repositories.accounts.get(account.id)).resolves.toMatchObject({
          name: "User-defined account name",
        });
        await expect(repositories.ownerContexts.get("shared")).resolves.toEqual({
          ownerContext: "shared",
          label: "User-defined owner label",
        });
      } finally {
        await connection.client.end();
      }
    },
  );

  it.runIf(testDatabaseUrl !== undefined)(
    "updates and filters active accounts and categories",
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
      };

      try {
        await repositories.accounts.save({
          id: "account-test-active",
          name: "Test account",
          ownerContext: "shared",
          active: true,
        });
        await repositories.accounts.save({
          id: "account-test-active",
          name: "Renamed account",
          ownerContext: "person_b",
          active: false,
        });
        await repositories.categories.save({
          id: "category-test-active",
          name: "Test category",
          active: true,
        });
        await repositories.categories.save({
          id: "category-test-active",
          name: "Renamed category",
          active: false,
        });

        await expect(repositories.accounts.list()).resolves.toContainEqual({
          id: "account-test-active",
          name: "Renamed account",
          ownerContext: "person_b",
          active: false,
        });
        await expect(repositories.accounts.listActive()).resolves.not.toContainEqual(
          expect.objectContaining({ id: "account-test-active" }),
        );
        await expect(repositories.categories.list()).resolves.toContainEqual({
          id: "category-test-active",
          name: "Renamed category",
          active: false,
        });
        await expect(repositories.categories.listActive()).resolves.not.toContainEqual(
          expect.objectContaining({ id: "category-test-active" }),
        );

        await repositories.categories.save({
          id: "category-normalized-a",
          name: " Ｆｏｏ  Bar ",
          active: true,
        });
        await expect(
          repositories.categories.save({
            id: "category-normalized-b",
            name: "foo bar",
            active: true,
          }),
        ).rejects.toThrow("Category name already exists"); // INT-FF-CAT-004-02
      } finally {
        await connection.client.end();
      }
    },
  );
});
