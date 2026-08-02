import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage, loginAsTestUserRequest } from "../support/auth.js";
import { listen } from "../support/server.js";

test("accounts list is visible after seeding", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    const response = await request.get(`${baseUrl}/admin/master-data`);
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain("Accounts");
    expect(body).toContain("Person A checking");
    expect(body).toContain("Person B checking");
    expect(body).toContain("Shared checking");
  } finally {
    await server.close();
  }
});

test("categories list is visible after seeding", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    const response = await request.get(`${baseUrl}/admin/master-data`);
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain("Categories");
    expect(body).toContain("Wohnen/Miete");
    expect(body).toContain("Lebensmittel");
    expect(body).toContain("Sonstiges");
  } finally {
    await server.close();
  }
});

test("account can be created and used in the transaction form", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/admin/master-data`);
    await page.getByLabel("New account name").fill("Vacation savings");
    await page.getByLabel("New account owner").selectOption("shared");
    await page.getByRole("button", { name: "Add account" }).click();
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.getByLabel("Transaction account")).toContainText("Vacation savings");
  } finally {
    await server.close();
  }
});

test("account can be edited", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/admin/master-data`);
    const row = page.getByRole("row").filter({ hasText: "Person A checking" });
    await row.getByRole("link", { name: "Edit account" }).click();
    await page.getByLabel("Account name").fill("Personal checking");
    await page.getByRole("button", { name: "Save account" }).click();

    await expect(page.getByRole("cell", { name: "Personal checking" })).toBeVisible();
    await expect(page.getByText("Person A checking")).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("account can be deactivated without losing existing transactions", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Transaction account").selectOption("account-person-a-checking");
    await page.getByLabel("Description").fill("Existing transaction");
    await page.getByLabel("Amount").fill("10.00");
    await page.getByLabel("Date").fill("2026-07-10");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page.goto(`${baseUrl}/admin/master-data`);
    await page
      .getByRole("row")
      .filter({ hasText: "Person A checking" })
      .getByRole("button", { name: "Deactivate account" })
      .click();
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.getByRole("cell", { name: "Existing transaction" })).toBeVisible();
    await expect(page.getByLabel("Transaction account")).not.toContainText("Person A checking");
  } finally {
    await server.close();
  }
});

test("account owner display names can be edited", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/admin/master-data`);
    await page.getByLabel("Owner name for person_a").fill("Daniel");
    await page.getByRole("button", { name: "Save owner name for person_a" }).click();

    await expect(page.getByLabel("Owner name for person_a")).toHaveValue("Daniel");
    await expect(
      page.getByRole("row").filter({ hasText: "Person A checking" }).getByRole("cell", {
        name: "Daniel",
      }),
    ).toBeVisible();
  } finally {
    await server.close();
  }
});

test("edited account owner display names appear in transaction and income filters", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/admin/master-data`);
    await page.getByLabel("Owner name for shared").fill("Household");
    await page.getByRole("button", { name: "Save owner name for shared" }).click();

    await page.goto(`${baseUrl}/transactions`);
    await expect(page.getByLabel("Owner context")).toContainText("Household");

    await page.goto(`${baseUrl}/income`);
    await expect(page.getByLabel("Filter owner context")).toContainText("Household");
  } finally {
    await server.close();
  }
});

test("category can be created and used in the transaction form", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/admin/master-data`);
    await page.getByLabel("New category name").fill("Hobbies");
    await page.getByRole("button", { name: "Add category" }).click();
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.locator("#transaction-form").getByLabel("Category")).toContainText("Hobbies");
  } finally {
    await server.close();
  }
});

test("category can be edited", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/admin/master-data`);
    const row = page.getByRole("row").filter({ hasText: "Lebensmittel" });
    await row.getByRole("link", { name: "Edit category" }).click();
    await page.getByLabel("Category name").fill("Groceries");
    await page.getByRole("button", { name: "Save category" }).click();

    await expect(page.getByRole("cell", { name: "Groceries" })).toBeVisible();
    await expect(page.getByText("Lebensmittel")).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("category can be deactivated without losing existing transactions", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page
      .locator("#transaction-form")
      .getByLabel("Category")
      .selectOption("category-groceries");
    await page.getByLabel("Description").fill("Existing groceries");
    await page.getByLabel("Amount").fill("10.00");
    await page.getByLabel("Date").fill("2026-07-10");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page.goto(`${baseUrl}/admin/master-data`);
    await page
      .getByRole("row")
      .filter({ hasText: "Lebensmittel" })
      .getByRole("button", { name: "Deactivate category" })
      .click();
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.getByRole("cell", { name: "Existing groceries" })).toBeVisible();
    await expect(page.locator("#transaction-form").getByLabel("Category")).not.toContainText(
      "Lebensmittel",
    );
  } finally {
    await server.close();
  }
});
