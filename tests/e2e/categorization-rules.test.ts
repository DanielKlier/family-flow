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
    await page.getByLabel("Fixed cost action").selectOption("fixed");
    await page.getByLabel("Priority").fill("10");
    await page.getByRole("button", { name: "Add rule" }).click();

    await expect(page.getByRole("cell", { name: "Groceries rule", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "supermarket", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "mark fixed", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("categorization rules can mark existing transactions as fixed costs", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Transaction account").selectOption("account-shared-checking");
    await page.locator("#transaction-form").getByLabel("Category").selectOption("category-other");
    await page.getByLabel("Date").fill("2026-07-01");
    await page.getByLabel("Description").fill("Monthly landlord payment");
    await page.getByLabel("Amount").fill("1200.00");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Rule name").fill("Fixed rent rule");
    await page.getByLabel("Search text").fill("landlord");
    await page.getByLabel("Rule category").selectOption("category-housing-rent");
    await page.getByLabel("Fixed cost action").selectOption("fixed");
    await page.getByLabel("Priority").fill("1");
    await page.getByRole("button", { name: "Add rule" }).click();
    await page.getByRole("button", { name: "Apply rules to existing transactions" }).click();

    await page.goto(`${baseUrl}/transactions`);
    const row = page.getByRole("row").filter({ hasText: "Monthly landlord payment" });
    await expect(row.getByRole("cell", { name: "Wohnen/Miete", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "fixed", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-CAT-002-03: categorization rules reapply mark and unmark transfer actions to existing transactions", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Transaction account").selectOption("account-shared-checking");
    await page.locator("#transaction-form").getByLabel("Category").selectOption("category-other");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByLabel("Description").fill("Transfer settlement");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Rule name").fill("Transfer reapply rule");
    await page.getByLabel("Search text").fill("settlement");
    await page.getByLabel("Rule category").selectOption("category-other");
    await page.getByLabel("Internal transfer action").selectOption("mark");
    await page.getByLabel("Priority").fill("1");
    await page.getByRole("button", { name: "Add rule" }).click();
    await page.getByRole("button", { name: "Apply rules to existing transactions" }).click();

    await page.goto(`${baseUrl}/transactions`);
    let row = page.getByRole("row").filter({ hasText: "Transfer settlement" });
    await expect(row.getByRole("cell", { name: "Internal transfer", exact: true })).toBeVisible();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page
      .getByRole("row")
      .filter({ hasText: "Transfer reapply rule" })
      .getByRole("link", { name: "Edit", exact: true })
      .click();
    await page.getByLabel("Internal transfer action").selectOption("unmark");
    await page.getByRole("button", { name: "Save rule" }).click();
    await page.getByRole("button", { name: "Apply rules to existing transactions" }).click();

    await page.goto(`${baseUrl}/transactions`);
    row = page.getByRole("row").filter({ hasText: "Transfer settlement" });
    await expect(row.getByRole("cell", { name: "Internal transfer", exact: true })).toHaveCount(0);
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

test("categorization rules can be edited", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Rule name").fill("Old groceries rule");
    await page.getByLabel("Search text").fill("market");
    await page.getByLabel("Rule category").selectOption("category-groceries");
    await page.getByLabel("Priority").fill("10");
    await page.getByRole("button", { name: "Add rule" }).click();

    await page
      .getByRole("row")
      .filter({ hasText: "Old groceries rule" })
      .getByRole("link", { name: "Edit", exact: true })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Edit Categorization Rule" }),
    ).toBeVisible();
    await page.getByLabel("Rule name").fill("Updated groceries rule");
    await page.getByLabel("Search text").fill("supermarket");
    await page.getByLabel("Priority").fill("1");
    await page.getByRole("button", { name: "Save rule" }).click();

    await expect(
      page.getByRole("cell", { name: "Updated groceries rule", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "supermarket", exact: true })).toBeVisible();
    await expect(page.getByText("Old groceries rule")).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("categorization rules can be deleted", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Rule name").fill("Delete groceries rule");
    await page.getByLabel("Search text").fill("market");
    await page.getByLabel("Rule category").selectOption("category-groceries");
    await page.getByLabel("Priority").fill("10");
    await page.getByRole("button", { name: "Add rule" }).click();

    await page
      .getByRole("row")
      .filter({ hasText: "Delete groceries rule" })
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await expect(page.getByText("Delete groceries rule")).not.toBeVisible();
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
    await page
      .getByRole("row")
      .filter({ hasText: "Supermarket purchase" })
      .getByRole("link", { name: "Edit", exact: true })
      .click();

    await expect(page.locator("#transaction-form").getByLabel("Category")).toHaveValue(
      "category-groceries",
    );
  } finally {
    await server.close();
  }
});
