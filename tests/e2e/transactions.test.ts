import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { listen } from "../support/server.js";

test("manual booked expense can be created", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await page.goto(`${baseUrl}/auth/test-login`);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Groceries");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByLabel("Transaction status").selectOption("booked");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByRole("cell", { name: "Groceries", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "booked", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "42.99", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("planned expense can be created", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await page.goto(`${baseUrl}/auth/test-login`);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Planned rent");
    await page.getByLabel("Amount").fill("1200.00");
    await page.getByLabel("Date").fill("2026-07-01");
    await page.getByLabel("Transaction status").selectOption("planned");
    await page.getByLabel("Fixed cost").check();
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
    await page.goto(`${baseUrl}/auth/test-login`);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Old description");
    await page.getByLabel("Amount").fill("10.00");
    await page.getByLabel("Date").fill("2026-07-10");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page.getByRole("link", { name: "Edit Old description" }).click();
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
    await page.goto(`${baseUrl}/auth/test-login`);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Delete me");
    await page.getByLabel("Amount").fill("10.00");
    await page.getByLabel("Date").fill("2026-07-10");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page.getByRole("button", { name: "Delete Delete me" }).click();

    await expect(page.getByRole("cell", { name: "Delete me", exact: true })).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("transactions can be filtered by owner context", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await page.goto(`${baseUrl}/auth/test-login`);
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
