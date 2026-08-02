import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("recurring income can be created", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/income`);
    const incomeForm = page.locator("#income-form");
    await incomeForm.getByLabel("Income name").fill("Salary Person A");
    await incomeForm.getByLabel("Owner context").selectOption("person_a");
    await incomeForm.getByLabel("Amount").fill("3500.00");
    await incomeForm.getByLabel("Start month").fill("2026-01");
    await incomeForm.getByRole("button", { name: "Add income" }).click();

    await expect(page.getByRole("cell", { name: "Salary Person A", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "person_a", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "3500.00", exact: true })).toBeVisible();
    await expect(page.getByText("Monthly planned income: 3500.00")).toBeVisible();
  } finally {
    await server.close();
  }
});

test("income month fields show the expected month format", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/income`);

    await expect(page.locator("#income-form").getByLabel("Start month")).toHaveAttribute(
      "placeholder",
      "YYYY-MM",
    );
    await expect(page.locator("#income-form").getByLabel("End month")).toHaveAttribute(
      "placeholder",
      "YYYY-MM",
    );
    await expect(
      page.locator("#income-override-form").getByLabel("Override month"),
    ).toHaveAttribute("placeholder", "YYYY-MM");
    await expect(page.locator("#income-filters").getByLabel("Calculation month")).toHaveAttribute(
      "placeholder",
      "YYYY-MM",
    );
  } finally {
    await server.close();
  }
});

test("monthly income override can be captured", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/income`);
    const incomeForm = page.locator("#income-form");
    await incomeForm.getByLabel("Income name").fill("Salary Person A");
    await incomeForm.getByLabel("Amount").fill("3500.00");
    await incomeForm.getByLabel("Start month").fill("2026-01");
    await incomeForm.getByRole("button", { name: "Add income" }).click();
    const overrideForm = page.locator("#income-override-form");
    await overrideForm.getByLabel("Override income").selectOption({ label: "Salary Person A" });
    await overrideForm.getByLabel("Override month").fill("2026-08");
    await overrideForm.getByLabel("Override amount").fill("1800.00");
    await overrideForm.getByLabel("Override note").fill("Reduced salary");
    await page.getByRole("button", { name: "Save override" }).click();
    await page.getByLabel("Calculation month").fill("2026-08");
    await page.getByRole("button", { name: "Update calculation" }).click();

    await expect(page.getByRole("cell", { name: "Reduced salary", exact: true })).toBeVisible();
    await expect(page.getByText("Monthly planned income: 1800.00")).toBeVisible();
  } finally {
    await server.close();
  }
});

test("income can be filtered by owner context", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/income`);
    const incomeForm = page.locator("#income-form");
    await incomeForm.getByLabel("Income name").fill("Salary Person A");
    await incomeForm.getByLabel("Owner context").selectOption("person_a");
    await incomeForm.getByLabel("Amount").fill("3500.00");
    await incomeForm.getByLabel("Start month").fill("2026-01");
    await incomeForm.getByRole("button", { name: "Add income" }).click();
    await expect(page.getByRole("cell", { name: "Salary Person A", exact: true })).toBeVisible();
    const updatedIncomeForm = page.locator("#income-form");
    await updatedIncomeForm.getByLabel("Income name").fill("Salary Person B");
    await updatedIncomeForm.getByLabel("Owner context").selectOption("person_b");
    await updatedIncomeForm.getByLabel("Amount").fill("2500.00");
    await updatedIncomeForm.getByLabel("Start month").fill("2026-01");
    await updatedIncomeForm.getByRole("button", { name: "Add income" }).click();
    await page.getByLabel("Filter owner context").selectOption("person_b");
    await page.getByRole("button", { name: "Apply income filters" }).click();

    await expect(page.getByRole("cell", { name: "Salary Person B", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Salary Person A", exact: true }),
    ).not.toBeVisible();
    await expect(page.getByText("Monthly planned income: 2500.00")).toBeVisible();
  } finally {
    await server.close();
  }
});
