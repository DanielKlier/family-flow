import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("CSV upload shows a normalized transaction preview", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Import account").selectOption("account-shared-checking");
    await page.getByLabel("Date column").fill("Date");
    await page.getByLabel("Amount column").fill("Amount");
    await page.getByLabel("Description column").fill("Description");
    await page.getByLabel("Payee column").fill("Payee");
    await page.getByLabel("CSV file").setInputFiles({
      name: "transactions.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date;Payee;Description;Amount\n15.07.2026;Shop;Card payment;-42,99"),
    });
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
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Import account").selectOption("account-shared-checking");
    await page.getByLabel("CSV encoding").selectOption("latin1");
    await page.getByLabel("Date column").fill("Date");
    await page.getByLabel("Amount column").fill("Amount");
    await page.getByLabel("Description column").fill("Description");
    await page.getByLabel("Payee column").fill("Payee");
    await page.getByLabel("CSV file").setInputFiles({
      name: "transactions-latin1.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date;Payee;Description;Amount\n15.07.26;München;Bäckerei;-4,20",
        "latin1",
      ),
    });
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
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Import account").selectOption("account-shared-checking");
    await page.getByLabel("Date column").fill("Date");
    await page.getByLabel("Amount column").fill("Amount");
    await page.getByLabel("Description column").fill("Description");
    await page.getByLabel("Payee column").fill("Payee");
    await page.getByLabel("Category column").fill("Category");
    await page.getByLabel("CSV file").setInputFiles({
      name: "transactions.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date;Payee;Description;Amount;Category\n15.07.2026;Shop;Imported groceries;-42,99;Lebensmittel",
      ),
    });
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm import" }).click();

    await expect(page).toHaveURL(`${baseUrl}/transactions`);
    await expect(page.getByRole("cell", { name: "Imported groceries", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "42.99", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Edit Imported groceries" }).click();
    await expect(page.getByLabel("Category")).toHaveValue("category-groceries");
  } finally {
    await server.close();
  }
});
