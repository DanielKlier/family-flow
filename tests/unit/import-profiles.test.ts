import { describe, expect, it } from "vitest";

import { createImportProfile } from "../../src/core/imports/import-profile.js";

describe("import profiles", () => {
  it("creates a valid import profile", () => {
    expect(
      createImportProfile({
        id: "profile-generic-bank",
        name: "Generic bank",
        kind: "custom",
        delimiter: ";",
        encoding: "utf8",
        dateColumn: "Date",
        amountColumn: "Amount",
        descriptionColumn: "Description",
        payeeColumn: "Payee",
      }),
    ).toEqual({
      id: "profile-generic-bank",
      name: "Generic bank",
      kind: "custom",
      delimiter: ";",
      encoding: "utf8",
      dateFormat: "DD.MM.YYYY",
      decimalFormat: "comma-decimal",
      dateColumn: "Date",
      amountColumn: "Amount",
      descriptionColumn: "Description",
      payeeColumn: "Payee",
      purposeColumn: null,
      categoryColumn: null,
    });
  });

  it("preserves the tab delimiter instead of trimming it as whitespace", () => {
    const profile = createImportProfile({
      id: "profile-tab-delimited",
      name: "Tab-delimited bank",
      kind: "custom",
      delimiter: "\t",
      encoding: "utf8",
      dateColumn: "Date",
      amountColumn: "Amount",
      descriptionColumn: "Description",
    });

    expect(profile.delimiter).toBe("\t");
  });

  it("rejects incomplete import profile mappings", () => {
    expect(() =>
      createImportProfile({
        id: "profile-invalid",
        name: "Invalid",
        kind: "custom",
        delimiter: ";",
        encoding: "utf8",
        dateColumn: "",
        amountColumn: "Amount",
        descriptionColumn: "Description",
      }),
    ).toThrow("Import profile date column is required");
  });
});
