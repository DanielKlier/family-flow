import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
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

    await expect(page.getByRole("cell", { name: "new", exact: true })).toHaveCount(1);
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

test("CSV import profiles can be saved and reused", async ({ page }) => {
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
