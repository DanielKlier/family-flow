import { describe, expect, it } from "vitest";

import { InMemoryImportProfileRepository } from "../../src/adapters/db/in-memory-import-profile-repository.js";
import { seedImportProfiles } from "../../src/adapters/db/seeds/import-profiles.js";
import { createImportProfile } from "../../src/core/imports/import-profile.js";

describe("import profile repositories", () => {
  it("does not seed concrete import profiles by default", async () => {
    const importProfiles = new InMemoryImportProfileRepository();

    await seedImportProfiles({ importProfiles });

    await expect(importProfiles.list()).resolves.toEqual([]);
  });

  it("stores and lists user-created import profiles", async () => {
    const importProfiles = new InMemoryImportProfileRepository();
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

    await importProfiles.save(profile);

    await expect(importProfiles.list()).resolves.toEqual([profile]);
    await expect(importProfiles.get("profile-generic-bank")).resolves.toEqual(profile);
  });

  it("replaces an import profile when saving a profile with the same ID", async () => {
    const importProfiles = new InMemoryImportProfileRepository();
    const id = "profile-replaced";
    const original = createImportProfile({
      id,
      name: "Original profile",
      kind: "custom",
      delimiter: ";",
      encoding: "utf8",
      dateColumn: "Date",
      amountColumn: "Amount",
      descriptionColumn: "Description",
      payeeColumn: "Payee",
    });
    const replacement = createImportProfile({
      id,
      name: "Replacement profile",
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

    await importProfiles.save(original);
    await importProfiles.save(replacement);

    await expect(importProfiles.get(id)).resolves.toEqual(replacement);
    await expect(importProfiles.list()).resolves.toEqual([replacement]);
  });
});
