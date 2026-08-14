import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import type { ImportPreviewBatch } from "../../src/ports/repositories/import-preview-batch-repository.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("CSV upload shows a normalized transaction preview", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await fillDefaultCsvMapping(page);
    await uploadCsv(page, "Date;Payee;Description;Amount\n15.07.2026;Shop;Card payment;-42,99");
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByRole("heading", { name: "Import preview" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "2026-07-15", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Card payment", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Shop", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "42.99", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("CSV upload decodes Latin1 umlauts in the preview", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await page.getByLabel("CSV encoding").selectOption("latin1");
    await page.getByLabel("CSV date format").selectOption("DD.MM.YY");
    await fillDefaultCsvMapping(page);
    await uploadCsv(
      page,
      Buffer.from("Date;Payee;Description;Amount\n15.07.26;München;Bäckerei;-4,20", "latin1"),
      "transactions-latin1.csv",
    );
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByRole("cell", { name: "München", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Bäckerei", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "2026-07-15", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-CSV-008-01 INT-FF-CSV-008-01: confirmation accepts only an opaque server batch ID", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await fillDefaultCsvMapping(page);
    await uploadCsv(
      page,
      "Date;Payee;Description;Amount\n15.07.2026;Shop;Server-authoritative import;-42,99",
    );
    await page.getByRole("button", { name: "Preview import" }).click();

    const batchId = page.locator('form[action="/imports/csv/confirm"] input[name="batchId"]');
    await expect(batchId).toHaveValue(/.+/);
    await expect(page.locator('input[name="rowsJson"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Confirm import" }).click();
    await expect(page).toHaveURL(`${baseUrl}/transactions`);
    await expect(
      page.getByRole("cell", { name: "Server-authoritative import", exact: true }),
    ).toBeVisible();
  } finally {
    await server.close();
  }
});

test("CSV import confirmation stores previewed transactions", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await fillDefaultCsvMapping(page);
    await page.getByLabel("Category column").fill("Category");
    await uploadCsv(
      page,
      "Date;Payee;Description;Amount;Category\n15.07.2026;Shop;Imported groceries;-42,99;Lebensmittel",
    );
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm import" }).click();

    await expect(page).toHaveURL(`${baseUrl}/transactions`);
    await expect(page.getByRole("cell", { name: "Imported groceries", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "42.99", exact: true })).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: "Imported groceries" })
      .getByRole("link", { name: "Edit", exact: true })
      .click();
    await expect(page.getByLabel("Category")).toHaveValue("category-groceries");
  } finally {
    await server.close();
  }
});

test("E2E-FF-CSV-004-02: CSV preview persists line-aware canonical outcomes", async ({ page }) => {
  let savedBatch: ImportPreviewBatch | undefined;
  const server = buildServer({
    importPreviewBatches: {
      async save(batch) {
        savedBatch = batch;
      },
      async withinTransaction<T>(work: () => Promise<T>) {
        return work();
      },
      async consumePreviewBatch() {
        return null;
      },
      async saveTransactions() {},
    },
  });

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await fillDefaultCsvMapping(page);
    await uploadCsv(
      page,
      [
        "Date;Payee;Description;Amount",
        "15.07.2026;Shop;Imported;-42,99",
        "15.07.2026;Shop;Imported;-42,99",
        "16.07.2026;Bank;Neutral;0,00",
        "17.07.2026;Shop;Malformed;-1.2.3,45",
      ].join("\n"),
    );
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByRole("heading", { name: "Import preview" })).toBeVisible();

    expect(savedBatch?.outcomes).toEqual([
      expect.objectContaining({ line: 2, outcome: "importable", reason: null }),
      { line: 3, outcome: "duplicate", reason: "already-imported" },
      { line: 4, outcome: "ignored", reason: "amount-not-negative" },
      { line: 5, outcome: "invalid", reason: "invalid-amount" },
    ]);
  } finally {
    await server.close();
  }
});

test("CSV import marks duplicates and confirms only new transactions", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await fillDefaultCsvMapping(page);
    await uploadCsv(
      page,
      [
        "Date;Payee;Description;Amount",
        "15.07.2026;Shop;Imported duplicate;-42,99",
        "15.07.2026;Shop;Imported duplicate;-42,99",
      ].join("\n"),
    );
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByRole("cell", { name: "importable", exact: true })).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "duplicate", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Confirm import" }).click();

    await expect(page).toHaveURL(`${baseUrl}/transactions`);
    await expect(page.getByRole("cell", { name: "Imported duplicate", exact: true })).toHaveCount(
      1,
    );
  } finally {
    await server.close();
  }
});

test("E2E-FF-CSV-012-01: imports otherwise identical rows with distinct purposes", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await fillDefaultCsvMapping(page);
    await page.getByLabel("Purpose column").fill("Purpose");
    await uploadCsv(
      page,
      [
        "Date;Payee;Description;Amount;Purpose",
        "15.07.2026;Shop;Card payment;-42,99;January groceries",
        "15.07.2026;Shop;Card payment;-42,99;February groceries",
      ].join("\n"),
    );
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByRole("cell", { name: "importable", exact: true })).toHaveCount(2);
    await page.getByRole("button", { name: "Confirm import" }).click();

    await expect(page).toHaveURL(`${baseUrl}/transactions`);
    await expect(page.getByRole("cell", { name: "Card payment", exact: true })).toHaveCount(2);
    const editUrls = await page
      .getByRole("link", { name: "Edit", exact: true })
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    const persistedPurposes: string[] = [];
    for (const editUrl of editUrls) {
      await page.goto(editUrl);
      persistedPurposes.push(await page.getByLabel("Purpose").inputValue());
    }
    expect(persistedPurposes.sort()).toEqual(["February groceries", "January groceries"]);
  } finally {
    await server.close();
  }
});

test("E2E-FF-CSV-001-02: CSV import profiles can be saved and reused", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await page.getByLabel("Profile name").fill("Generic grocery profile");
    await page.getByLabel("CSV encoding").selectOption("latin1");
    await page.getByLabel("Date column").fill("Booking date");
    await page.getByLabel("Amount column").fill("Value");
    await page.getByLabel("Description column").fill("Purpose");
    await page.getByLabel("Payee column").fill("Counterparty");
    await page.getByLabel("Category column").fill("Group");
    await expect(page.locator('input[name="profileId"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Save import profile" }).click();

    await expect(page.getByText("Import profile saved.")).toBeVisible();

    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Import profile").selectOption({ label: "Generic grocery profile" });
    await page.getByRole("button", { name: "Load import profile" }).click();

    await expect(page.getByLabel("CSV encoding")).toHaveValue("latin1");
    await expect(page.getByLabel("Date column")).toHaveValue("Booking date");
    await expect(page.getByLabel("Amount column")).toHaveValue("Value");
    await expect(page.getByLabel("Description column")).toHaveValue("Purpose");
    await expect(page.getByLabel("Payee column")).toHaveValue("Counterparty");
    await expect(page.getByLabel("Category column")).toHaveValue("Group");
  } finally {
    await server.close();
  }
});

test("CSV import saves edits to a loaded profile in place", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await page.getByLabel("Profile name").fill("Original grocery profile");
    await page.getByLabel("Date column").fill("Booking date");
    await page.getByLabel("Amount column").fill("Amount");
    await page.getByLabel("Description column").fill("Description");
    await page.getByRole("button", { name: "Save import profile" }).click();

    const originalProfileId = new URL(page.url()).searchParams.get("profileId");
    if (originalProfileId === null) {
      throw new Error("Saving a new import profile must select it");
    }

    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Import profile").selectOption(originalProfileId);
    await page.getByRole("button", { name: "Load import profile" }).click();
    await expect(page.locator('input[name="profileId"]')).toHaveValue(originalProfileId);

    await page.getByLabel("Profile name").fill("Updated grocery profile");
    await page.getByLabel("Date column").fill("Updated booking date");
    await page.getByRole("button", { name: "Save import profile" }).click();

    expect(new URL(page.url()).searchParams.get("profileId")).toBe(originalProfileId);
    await expect(page.getByLabel("Profile name")).toHaveValue("Updated grocery profile");
    await expect(page.getByLabel("Date column")).toHaveValue("Updated booking date");
    await expect(
      page.getByRole("option", { name: "Updated grocery profile", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("option", { name: "Original grocery profile", exact: true }),
    ).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("CSV import rejects an unknown submitted profile ID without creating a profile", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    const response = await page.request.post(`${baseUrl}/imports/csv/profiles`, {
      form: {
        profileId: "missing-profile-id",
        profileName: "Profile that must not be created",
        delimiter: ";",
        encoding: "utf8",
        dateFormat: "DD.MM.YYYY",
        decimalFormat: "comma-decimal",
        dateColumn: "Date",
        amountColumn: "Amount",
        descriptionColumn: "Description",
        payeeColumn: "Payee",
        purposeColumn: "",
        categoryColumn: "",
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("Import profile");
    await page.goto(`${baseUrl}/imports/csv`);
    await expect(
      page.getByRole("option", { name: "Profile that must not be created", exact: true }),
    ).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("E2E-FF-CSV-001-01 E2E-FF-CSV-002-01 E2E-FF-TXN-004-01: profiles persist finite format options and map purpose separately", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await page.getByLabel("Profile name").fill("Comma purpose profile");
    await page.getByLabel("CSV delimiter").selectOption(",");
    await page.getByLabel("CSV encoding").selectOption("utf8");
    await page.getByLabel("CSV date format").selectOption("YYYY-MM-DD");
    await page.getByLabel("CSV decimal format").selectOption("dot-decimal");
    await page.getByLabel("Date column").fill("Booked");
    await page.getByLabel("Amount column").fill("Value");
    await page.getByLabel("Description column").fill("Description");
    await page.getByLabel("Payee column").fill("");
    await page.getByLabel("Purpose column").fill("Purpose");
    await page.getByRole("button", { name: "Save import profile" }).click();

    await page.getByLabel("Import profile").selectOption({ label: "Comma purpose profile" });
    await page.getByRole("button", { name: "Load import profile" }).click();
    await expect(page.getByLabel("CSV delimiter")).toHaveValue(",");
    await expect(page.getByLabel("CSV date format")).toHaveValue("YYYY-MM-DD");
    await expect(page.getByLabel("CSV decimal format")).toHaveValue("dot-decimal");
    await expect(page.getByLabel("Purpose column")).toHaveValue("Purpose");

    await page.getByLabel("Import account").selectOption("account-shared-checking");
    await uploadCsv(
      page,
      "Booked,Value,Description,Purpose\n2026-07-15,-42.99,Card payment,Monthly groceries",
    );
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByRole("cell", { name: "Monthly groceries", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm import" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Card payment" })
      .getByRole("link", { name: "Edit", exact: true })
      .click();
    await expect(page.getByLabel("Purpose")).toHaveValue("Monthly groceries");
  } finally {
    await server.close();
  }
});

test("E2E-FF-CSV-004-01 E2E-FF-CSV-009-01: preview displays outcomes and rejects non-atomic confirmation", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await fillDefaultCsvMapping(page);
    await uploadCsv(
      page,
      [
        "Date;Payee;Description;Amount",
        "15.07.2026;Shop;New expense;-42,99",
        "16.07.2026;Employer;Salary;2500,00",
        "31.02.2026;Shop;Impossible date;-10,00",
        "15.07.2026;Shop;New expense;-42,99",
      ].join("\n"),
    );
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByRole("cell", { name: "importable", exact: true })).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "ignored", exact: true })).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "invalid", exact: true })).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "duplicate", exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Confirm import" })).toBeDisabled();
    const batchId = await page.locator('input[name="batchId"]').inputValue();
    const directConfirmation = await page.request.post(`${baseUrl}/imports/csv/confirm`, {
      form: { batchId },
    });
    expect(directConfirmation.status()).toBe(500);
    await page.goto(`${baseUrl}/transactions`);
    await expect(page.getByRole("cell", { name: "New expense", exact: true })).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("CSV import applies categorization rules", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Rule name").fill("Groceries import rule");
    await page.getByLabel("Search text").fill("supermarket");
    await page.getByLabel("Rule category").selectOption("category-groceries");
    await page.getByLabel("Priority").fill("1");
    await page.getByRole("button", { name: "Add rule" }).click();

    await page.goto(`${baseUrl}/imports/csv`);
    await fillDefaultCsvMapping(page);
    await uploadCsv(
      page,
      "Date;Payee;Description;Amount\n15.07.2026;Shop;Supermarket purchase;-42,99",
    );
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm import" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Supermarket purchase" })
      .getByRole("link", { name: "Edit", exact: true })
      .click();

    await expect(page.getByLabel("Category")).toHaveValue("category-groceries");
  } finally {
    await server.close();
  }
});

test("E2E-FF-CAT-002-02: CSV preview snapshots a categorization rule transfer action before confirmation", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Rule name").fill("Transfer import rule");
    await page.getByLabel("Search text").fill("settlement");
    await page.getByLabel("Rule category").selectOption("category-other");
    await page.getByLabel("Internal transfer action").selectOption("mark");
    await page.getByLabel("Priority").fill("1");
    await page.getByRole("button", { name: "Add rule" }).click();

    await page.goto(`${baseUrl}/imports/csv`);
    await fillDefaultCsvMapping(page);
    await uploadCsv(
      page,
      "Date;Payee;Description;Amount\n15.07.2026;Bank;Monthly settlement;-42,99",
    );
    await page.getByRole("button", { name: "Preview import" }).click();
    const batchId = await page.locator('input[name="batchId"]').inputValue();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page
      .getByRole("row")
      .filter({ hasText: "Transfer import rule" })
      .getByRole("link", { name: "Edit", exact: true })
      .click();
    await page.getByLabel("Internal transfer action").selectOption("unmark");
    await page.getByRole("button", { name: "Save rule" }).click();

    const confirmation = await page.request.post(`${baseUrl}/imports/csv/confirm`, {
      form: { batchId },
    });
    expect(confirmation.status()).toBe(200);
    await page.goto(`${baseUrl}/transactions`);
    const row = page.getByRole("row").filter({ hasText: "Monthly settlement" });
    await expect(row.getByRole("cell", { name: "Internal transfer", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("CSV import applies fixed-cost actions from categorization rules", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Rule name").fill("Rent import rule");
    await page.getByLabel("Search text").fill("landlord");
    await page.getByLabel("Rule category").selectOption("category-housing-rent");
    await page.getByLabel("Fixed cost action").selectOption("fixed");
    await page.getByLabel("Priority").fill("1");
    await page.getByRole("button", { name: "Add rule" }).click();

    await page.goto(`${baseUrl}/imports/csv`);
    await fillDefaultCsvMapping(page);
    await uploadCsv(
      page,
      "Date;Payee;Description;Amount\n01.07.2026;Landlord;Monthly landlord payment;-1200,00",
    );
    await page.getByRole("button", { name: "Preview import" }).click();
    await page.getByRole("button", { name: "Confirm import" }).click();

    const row = page.getByRole("row").filter({ hasText: "Monthly landlord payment" });
    await expect(row.getByRole("cell", { name: "Wohnen/Miete", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "fixed", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("CSV import profile errors are shown on the import page", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await openCsvImportPage(page, baseUrl);
    await page.getByLabel("Profile name").fill("");
    await page.getByRole("button", { name: "Save import profile" }).click();

    await expect(page.getByText("Profile name is required")).toBeVisible();
  } finally {
    await server.close();
  }
});

async function openCsvImportPage(page: Page, baseUrl: string): Promise<void> {
  await loginAsTestUserPage(page, baseUrl);
  await page.goto(`${baseUrl}/imports/csv`);
}

async function fillDefaultCsvMapping(page: Page): Promise<void> {
  await page.getByLabel("Import account").selectOption("account-shared-checking");
  await page.getByLabel("Date column").fill("Date");
  await page.getByLabel("Amount column").fill("Amount");
  await page.getByLabel("Description column").fill("Description");
  await page.getByLabel("Payee column").fill("Payee");
}

async function uploadCsv(
  page: Page,
  content: string | Buffer,
  name = "transactions.csv",
): Promise<void> {
  await page.getByLabel("CSV file").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
  });
}
