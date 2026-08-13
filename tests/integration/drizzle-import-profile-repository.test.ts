import { describe, expect, it } from "vitest";

import { DrizzleImportProfileRepository } from "../../src/adapters/db/drizzle-import-profile-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { seedImportProfiles } from "../../src/adapters/db/seeds/import-profiles.js";
import { createImportProfile } from "../../src/core/imports/import-profile.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle import profile repository", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "stores and lists user-created import profiles",
    async () => {
      if (testDatabaseUrl === undefined) {
        throw new Error("TEST_DATABASE_URL is required");
      }

      await migrate(testDatabaseUrl);

      const connection = createPostgresConnection(testDatabaseUrl);
      const repositories = {
        importProfiles: new DrizzleImportProfileRepository(connection.db),
      };

      try {
        await seedImportProfiles(repositories);
        const profile = createImportProfile({
          id: "profile-generic-bank",
          name: "Generic bank",
          kind: "custom",
          delimiter: ";",
          encoding: "utf8",
          dateColumn: "Date",
          amountColumn: "Amount",
          descriptionColumn: "Description",
          payeeColumn: "Payee",
        });
        await repositories.importProfiles.save(profile);

        await expect(repositories.importProfiles.list()).resolves.toEqual([profile]);

        const replacement = createImportProfile({
          id: "profile-generic-bank",
          name: "Updated generic bank",
          kind: "custom",
          delimiter: ",",
          encoding: "latin1",
          dateFormat: "YYYY-MM-DD",
          decimalFormat: "dot-decimal",
          dateColumn: "Booked",
          amountColumn: "Value",
          descriptionColumn: "Purpose",
          purposeColumn: "Purpose",
        });
        await repositories.importProfiles.save(replacement);

        await expect(repositories.importProfiles.get("profile-generic-bank")).resolves.toEqual(
          replacement,
        );
        await expect(repositories.importProfiles.list()).resolves.toEqual([replacement]);
      } finally {
        await connection.client.end();
      }
    },
  );
});
