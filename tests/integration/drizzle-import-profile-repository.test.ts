import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { DrizzleImportProfileRepository } from "../../src/adapters/db/drizzle-import-profile-repository.js";
import { migrate } from "../../src/adapters/db/migrate.js";
import { createPostgresConnection } from "../../src/adapters/db/postgres.js";
import { importProfiles } from "../../src/adapters/db/schema.js";
import { seedImportProfiles } from "../../src/adapters/db/seeds/import-profiles.js";
import { createImportProfile } from "../../src/core/imports/import-profile.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("Drizzle import profile repository", () => {
  it.runIf(testDatabaseUrl !== undefined)(
    "INT-FF-CSV-002-02 persists, orders, and replaces independent import profiles",
    async () => {
      if (testDatabaseUrl === undefined) {
        throw new Error("TEST_DATABASE_URL is required");
      }

      await migrate(testDatabaseUrl);
      const connection = createPostgresConnection(testDatabaseUrl);
      const repository = new DrizzleImportProfileRepository(connection.db);
      const alpha = createImportProfile({
        id: "profile-csv-alpha",
        name: "Alpha CSV profile",
        kind: "custom",
        delimiter: ",",
        encoding: "utf8",
        dateFormat: "DD.MM.YY",
        decimalFormat: "comma-decimal",
        dateColumn: "Booked",
        amountColumn: "Amount",
        descriptionColumn: "Description",
        payeeColumn: "Payee",
        purposeColumn: "Purpose",
        categoryColumn: "Category",
      });
      const zulu = createImportProfile({
        id: "profile-csv-zulu",
        name: "Zulu CSV profile",
        kind: "custom",
        delimiter: "\t",
        encoding: "latin1",
        dateFormat: "YYYY-MM-DD",
        decimalFormat: "dot-decimal",
        dateColumn: "Date",
        amountColumn: "Value",
        descriptionColumn: "Memo",
      });

      try {
        await repository.save(zulu);
        await repository.save(alpha);

        await expect(repository.get(alpha.id)).resolves.toEqual(alpha);
        await expect(repository.get(zulu.id)).resolves.toEqual(zulu);
        await expect(repository.list()).resolves.toEqual([alpha, zulu]);

        const replacement = createImportProfile({
          ...alpha,
          name: "Beta CSV profile",
          delimiter: ";",
          encoding: "latin1",
          dateFormat: "DD.MM.YYYY",
          decimalFormat: "dot-decimal",
          dateColumn: "Posting date",
          amountColumn: "Debit",
          descriptionColumn: "Details",
          payeeColumn: null,
          purposeColumn: null,
          categoryColumn: null,
        });
        await repository.save(replacement);

        await expect(repository.get(alpha.id)).resolves.toEqual(replacement);
        await expect(repository.get(zulu.id)).resolves.toEqual(zulu);
        await expect(repository.list()).resolves.toEqual([replacement, zulu]);
      } finally {
        await connection.db
          .delete(importProfiles)
          .where(inArray(importProfiles.id, [alpha.id, zulu.id]));
        await connection.client.end();
      }
    },
  );

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
        await connection.db
          .delete(importProfiles)
          .where(inArray(importProfiles.id, ["profile-generic-bank"]));
        await connection.client.end();
      }
    },
  );
});
