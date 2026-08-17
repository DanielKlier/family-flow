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
    expect(body).toContain("Konten");
    expect(body).toContain("Girokonto Person A");
    expect(body).toContain("Girokonto Person B");
    expect(body).toContain("Gemeinsames Girokonto");
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
    expect(body).toContain("Kategorien");
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
    await page.getByLabel("Neuer Kontoname").fill("Vacation savings");
    await page
      .locator('form[action="/admin/master-data/accounts"] select[name="ownerContext"]')
      .selectOption("shared");
    await page.getByRole("button", { name: "Konto hinzufügen" }).click();
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.locator("#transaction-form").getByLabel("Konto")).toContainText(
      "Vacation savings",
    );
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
    const row = page.getByRole("row").filter({ hasText: "Girokonto Person A" });
    await row.getByRole("link", { name: "Konto bearbeiten" }).click();
    await page.getByLabel("Kontoname").fill("Personal checking");
    await page.getByRole("button", { name: "Konto speichern" }).click();

    await expect(page.getByRole("cell", { name: "Personal checking" })).toBeVisible();
    await expect(page.getByText("Girokonto Person A")).not.toBeVisible();
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
    await page
      .locator("#transaction-form")
      .getByLabel("Konto")
      .selectOption("account-person-a-checking");
    await page.getByLabel("Beschreibung").fill("Existing transaction");
    await page.getByLabel("Betrag").fill("10,00");
    await page.getByLabel("Datum").fill("10.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page.goto(`${baseUrl}/admin/master-data`);
    await page
      .getByRole("row")
      .filter({ hasText: "Girokonto Person A" })
      .getByRole("button", { name: "Konto deaktivieren" })
      .click();
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.getByRole("cell", { name: "Existing transaction" })).toBeVisible();
    await expect(page.locator("#transaction-form").getByLabel("Konto")).not.toContainText(
      "Girokonto Person A",
    );
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
    await page.getByLabel("Eigentümername für person_a").fill("Daniel");
    await page.getByRole("button", { name: "Eigentümername für person_a speichern" }).click();

    await expect(page.getByLabel("Eigentümername für person_a")).toHaveValue("Daniel");
    await expect(
      page.getByRole("row").filter({ hasText: "Girokonto Person A" }).getByRole("cell", {
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
    await page.getByLabel("Eigentümername für shared").fill("Household");
    await page.getByRole("button", { name: "Eigentümername für shared speichern" }).click();

    await page.goto(`${baseUrl}/transactions`);
    await expect(page.getByLabel("Eigentümer")).toContainText("Household");

    await page.goto(`${baseUrl}/income`);
    await expect(page.getByLabel("Eigentümer filtern")).toContainText("Household");
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
    await page.getByLabel("Neuer Kategoriename").fill("Hobbies");
    await page.getByRole("button", { name: "Kategorie hinzufügen" }).click();
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.locator("#transaction-form").getByLabel("Kategorie")).toContainText(
      "Hobbies",
    );
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
    await row.getByRole("link", { name: "Kategorie bearbeiten" }).click();
    await page.getByLabel("Kategoriename").fill("Groceries");
    await page.getByRole("button", { name: "Kategorie speichern" }).click();

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
      .getByLabel("Kategorie")
      .selectOption("category-groceries");
    await page.getByLabel("Beschreibung").fill("Existing groceries");
    await page.getByLabel("Betrag").fill("10,00");
    await page.getByLabel("Datum").fill("10.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page.goto(`${baseUrl}/admin/master-data`);
    await page
      .getByRole("row")
      .filter({ hasText: "Lebensmittel" })
      .getByRole("button", { name: "Kategorie deaktivieren" })
      .click();
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.getByRole("cell", { name: "Existing groceries" })).toBeVisible();
    await expect(page.locator("#transaction-form").getByLabel("Kategorie")).not.toContainText(
      "Lebensmittel",
    );
  } finally {
    await server.close();
  }
});
