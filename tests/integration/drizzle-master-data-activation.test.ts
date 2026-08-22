import { describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "../../src/adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../../src/adapters/db/drizzle-category-repository.js";
import { DrizzleOwnerContextRepository } from "../../src/adapters/db/drizzle-owner-context-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle master-data activation", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-MDM-003-02 creates, edits, deactivates, reactivates, and filters accounts",
    async () => {
      if (testDatabaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(testDatabaseUrl);
      const connection = createPostgresConnection(testDatabaseUrl);
      const accounts = new DrizzleAccountRepository(connection.db);

      try {
        const id = "account-mdm-adapter-evidence";
        await accounts.save({
          id,
          name: "Adapter account",
          ownerContext: "shared",
          active: true,
        });
        await expect(accounts.get(id)).resolves.toMatchObject({ name: "Adapter account" });

        await accounts.save({
          id,
          name: "Edited adapter account",
          ownerContext: "person_a",
          active: false,
        });
        await expect(accounts.get(id)).resolves.toEqual({
          id,
          name: "Edited adapter account",
          ownerContext: "person_a",
          active: false,
        });
        await expect(accounts.listActive()).resolves.not.toContainEqual(
          expect.objectContaining({ id }),
        );

        await accounts.save({
          id,
          name: "Edited adapter account",
          ownerContext: "person_a",
          active: true,
        });
        await expect(accounts.listActive()).resolves.toContainEqual(
          expect.objectContaining({ id, active: true }),
        );
      } finally {
        await connection.client.end();
      }
    },
  );

  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-MDM-004-02 creates, edits, deactivates, reactivates, and filters categories",
    async () => {
      if (testDatabaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(testDatabaseUrl);
      const connection = createPostgresConnection(testDatabaseUrl);
      const categories = new DrizzleCategoryRepository(connection.db);

      try {
        const id = "category-mdm-adapter-evidence";
        await categories.save({ id, name: "Adapter category", active: true });
        await expect(categories.get(id)).resolves.toMatchObject({ name: "Adapter category" });

        await categories.save({ id, name: "Edited adapter category", active: false });
        await expect(categories.get(id)).resolves.toEqual({
          id,
          name: "Edited adapter category",
          active: false,
        });
        await expect(categories.listActive()).resolves.not.toContainEqual(
          expect.objectContaining({ id }),
        );

        await categories.save({ id, name: "Edited adapter category", active: true });
        await expect(categories.listActive()).resolves.toContainEqual(
          expect.objectContaining({ id, active: true }),
        );
      } finally {
        await connection.client.end();
      }
    },
  );

  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-MDM-005-01 preserves edited names and active state across a restart",
    async () => {
      if (testDatabaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
      await migrate(testDatabaseUrl);
      const firstConnection = createPostgresConnection(testDatabaseUrl);
      const firstRepositories = {
        accounts: new DrizzleAccountRepository(firstConnection.db),
        categories: new DrizzleCategoryRepository(firstConnection.db),
        ownerContexts: new DrizzleOwnerContextRepository(firstConnection.db),
      };
      const accountId = "account-shared-checking";
      const categoryId = "category-groceries";

      try {
        await seedMasterData(firstRepositories, createGermanLocalization());
        await firstRepositories.accounts.save({
          id: accountId,
          name: "Edited seeded account",
          ownerContext: "shared",
          active: false,
        });
        await firstRepositories.categories.save({
          id: categoryId,
          name: "Edited seeded category",
          active: false,
        });
      } finally {
        await firstConnection.client.end();
      }

      await migrate(testDatabaseUrl);
      const restartedConnection = createPostgresConnection(testDatabaseUrl);
      const restartedRepositories = {
        accounts: new DrizzleAccountRepository(restartedConnection.db),
        categories: new DrizzleCategoryRepository(restartedConnection.db),
        ownerContexts: new DrizzleOwnerContextRepository(restartedConnection.db),
      };

      try {
        await seedMasterData(restartedRepositories, createGermanLocalization());
        await expect(restartedRepositories.accounts.get(accountId)).resolves.toEqual({
          id: accountId,
          name: "Edited seeded account",
          ownerContext: "shared",
          active: false,
        });
        await expect(restartedRepositories.categories.get(categoryId)).resolves.toEqual({
          id: categoryId,
          name: "Edited seeded category",
          active: false,
        });
      } finally {
        await restartedConnection.client.end();
      }
    },
  );
});
