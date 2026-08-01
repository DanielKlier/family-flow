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
