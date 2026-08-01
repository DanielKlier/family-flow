import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("categorization rules can be created and listed", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);

    await expect(page.getByRole("heading", { name: "Categorization Rules" })).toBeVisible();

    await page.getByLabel("Rule name").fill("Groceries rule");
    await page.getByLabel("Search text").fill("supermarket");
    await page.getByLabel("Rule category").selectOption("category-groceries");
    await page.getByLabel("Priority").fill("10");
    await page.getByRole("button", { name: "Add rule" }).click();

    await expect(page.getByRole("cell", { name: "Groceries rule", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "supermarket", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("categorization rules can be restricted to an account", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);

    await page.getByLabel("Rule name").fill("Shared rent rule");
    await page.getByLabel("Search text").fill("landlord");
    await page.getByLabel("Rule category").selectOption("category-housing-rent");
    await page.getByLabel("Rule account").selectOption("account-shared-checking");
    await page.getByLabel("Priority").fill("1");
    await page.getByRole("button", { name: "Add rule" }).click();

    await expect(page.getByRole("cell", { name: "Shared rent rule", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Shared checking", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("categorization rules can be applied to existing transactions", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Transaction account").selectOption("account-shared-checking");
    await page.locator("#transaction-form").getByLabel("Category").selectOption("category-other");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByLabel("Description").fill("Supermarket purchase");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Rule name").fill("Existing groceries rule");
    await page.getByLabel("Search text").fill("supermarket");
    await page.getByLabel("Rule category").selectOption("category-groceries");
    await page.getByLabel("Priority").fill("1");
    await page.getByRole("button", { name: "Add rule" }).click();
    await page.getByRole("button", { name: "Apply rules to existing transactions" }).click();

    await page.goto(`${baseUrl}/transactions`);
    await page.getByRole("link", { name: "Edit Supermarket purchase" }).click();

    await expect(page.locator("#transaction-form").getByLabel("Category")).toHaveValue(
      "category-groceries",
    );
  } finally {
    await server.close();
  }
});
