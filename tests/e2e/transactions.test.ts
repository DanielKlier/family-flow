import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("manual booked expense can be created", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page
      .locator("#transaction-form")
      .getByLabel("Category")
      .selectOption("category-groceries");
    await page.getByLabel("Description").fill("Groceries");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByLabel("Transaction status").selectOption("booked");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByRole("cell", { name: "Groceries", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Category" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "booked", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "42.99", exact: true })).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: "Groceries" });
    await expect(row.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    await expect(row.getByRole("link", { name: "Edit Groceries" })).not.toBeVisible();
    await expect(row.getByRole("button", { name: "Delete Groceries" })).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-TXN-005-01: a manual expense can be marked, filtered, and unmarked as an internal transfer", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Transfer to savings");
    await page.getByLabel("Amount").fill("100.00");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByRole("button", { name: "Add transaction" }).click();

    const row = page.getByRole("row").filter({ hasText: "Transfer to savings" });
    const markButton = row.getByRole("button", { name: "Mark as transfer", exact: true });
    await expect(markButton).toHaveCount(1);
    await markButton.click();
    await expect(row.getByText("Internal transfer", { exact: true })).toBeVisible();

    await page.getByLabel("Transfer state").selectOption("marked");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Transfer to savings" })).toBeVisible();

    await page
      .getByRole("row")
      .filter({ hasText: "Transfer to savings" })
      .getByRole("button", { name: "Unmark transfer", exact: true })
      .click();
    await page.getByLabel("Transfer state").selectOption("unmarked");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Transfer to savings" })).toBeVisible();
    await expect(page.getByText("Internal transfer", { exact: true })).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("E2E-FF-TXN-005-02: an imported expense remains visible when marked and unmarked as an internal transfer", async ({
  page,
}) => {
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
      name: "internal-transfer.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date;Payee;Description;Amount\n15.07.2026;Bank;Imported transfer;-100,00",
      ),
    });
    await page.getByRole("button", { name: "Preview import" }).click();
    await page.getByRole("button", { name: "Confirm import" }).click();

    const row = page.getByRole("row").filter({ hasText: "Imported transfer" });
    const markButton = row.getByRole("button", { name: "Mark as transfer", exact: true });
    await expect(markButton).toHaveCount(1);
    await markButton.click();
    await expect(page.getByRole("row").filter({ hasText: "Imported transfer" })).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: "Imported transfer" })
      .getByRole("button", { name: "Unmark transfer", exact: true })
      .click();
    await expect(page.getByRole("row").filter({ hasText: "Imported transfer" })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("planned expense can be created", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Planned rent");
    await page.getByLabel("Amount").fill("1200.00");
    await page.getByLabel("Date").fill("2026-07-01");
    await page.getByLabel("Transaction status").selectOption("planned");
    await page.locator("#transaction-form").getByLabel("Fixed cost").check();
    await page.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByRole("cell", { name: "Planned rent", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "planned", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "fixed", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("transaction can be edited", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Old description");
    await page.getByLabel("Amount").fill("10.00");
    await page.getByLabel("Date").fill("2026-07-10");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Old description" })
      .getByRole("link", { name: "Edit", exact: true })
      .click();
    await page.getByLabel("Description").fill("Updated description");
    await page.getByRole("button", { name: "Save transaction" }).click();

    await expect(
      page.getByRole("cell", { name: "Updated description", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Old description")).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("transaction can be deleted", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Delete me");
    await page.getByLabel("Amount").fill("10.00");
    await page.getByLabel("Date").fill("2026-07-10");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Delete me" })
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await expect(page.getByRole("cell", { name: "Delete me", exact: true })).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("transactions can be filtered by owner context", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Personal groceries");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByLabel("Transaction account").selectOption("account-person-a-checking");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page.getByLabel("Description").fill("Shared rent");
    await page.getByLabel("Amount").fill("1200.00");
    await page.getByLabel("Date").fill("2026-07-01");
    await page.getByLabel("Transaction account").selectOption("account-shared-checking");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await page.getByLabel("Owner context").selectOption("shared");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page.getByRole("cell", { name: "Shared rent", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Personal groceries", exact: true }),
    ).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("transactions can be filtered by fixed-cost flag", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Variable groceries");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page.getByLabel("Description").fill("Fixed rent");
    await page.getByLabel("Amount").fill("1200.00");
    await page.getByLabel("Date").fill("2026-07-01");
    await page.locator("#transaction-form").getByLabel("Fixed cost").check();
    await page.getByRole("button", { name: "Add transaction" }).click();

    await page.getByLabel("Fixed cost filter").selectOption("fixed");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page.getByRole("cell", { name: "Fixed rent", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Variable groceries", exact: true }),
    ).not.toBeVisible();
  } finally {
    await server.close();
  }
});
