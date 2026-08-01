import { describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle master data repositories", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "stores and lists seeded accounts and categories",
    async () => {
      if (testDatabaseUrl === undefined) {
        throw new Error("TEST_DATABASE_URL is required");
      }

      await migrate(testDatabaseUrl);

      const connection = createPostgresConnection(testDatabaseUrl);
      const repositories = {
        accounts: new DrizzleAccountRepository(connection.db),
        categories: new DrizzleCategoryRepository(connection.db),
      };

      try {
        await seedMasterData(repositories);

        await expect(repositories.accounts.list()).resolves.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "account-person-a-checking", name: "Person A checking" }),
            expect.objectContaining({ id: "account-person-b-checking", name: "Person B checking" }),
            expect.objectContaining({ id: "account-shared-checking", name: "Shared checking" }),
          ]),
        );
        await expect(repositories.categories.list()).resolves.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "category-housing-rent", name: "Wohnen/Miete" }),
            expect.objectContaining({ id: "category-groceries", name: "Lebensmittel" }),
            expect.objectContaining({ id: "category-other", name: "Sonstiges" }),
          ]),
        );
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
      } finally {
        await connection.client.end();
      }
    },
  );
});
