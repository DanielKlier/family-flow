import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("E2E-FF-CAT-001-01: CSV purpose matches rules after NFKC and whitespace normalization", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Regelname").fill("Normalized purpose rule");
    await page.getByLabel("Suchtext").fill("supermarket einkauf");
    await page.getByLabel("Kategorie").selectOption("category-groceries");
    await page.getByLabel("Priorität").fill("1");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();

    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Importkonto").selectOption("account-shared-checking");
    await page.getByLabel("Datumsspalte").fill("Date");
    await page.getByLabel("Betragsspalte").fill("Amount");
    await page.getByLabel("Beschreibungsspalte").fill("Description");
    await page.getByLabel("Zahlungsempfängerspalte").fill("Payee");
    await page.getByLabel("Verwendungszweckspalte").fill("Purpose");
    await page.getByLabel("CSV-Datei").setInputFiles({
      name: "normalized-purpose.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date;Payee;Description;Amount;Purpose\n15.07.2026;Merchant;Card payment;-42,99;Ｓｕｐｅｒｍａｒｋｅｔ   EINKAUF",
      ),
    });
    await page.getByRole("button", { name: "Importvorschau anzeigen" }).click();
    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Import bestätigen" }).click();

    await page
      .getByRole("row")
      .filter({ hasText: "Card payment" })
      .getByRole("link", { name: "Bearbeiten", exact: true })
      .click();
    await expect(page.getByLabel("Kategorie")).toHaveValue("category-groceries");
  } finally {
    await server.close();
  }
});

test("E2E-FF-CAT-004-01: CSV mapped, rule, and fallback precedence retains matching fixed-cost actions", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Regelname").fill("Market fixed rule");
    await page.getByLabel("Suchtext").fill("market");
    await page.getByLabel("Kategorie").selectOption("category-groceries");
    await page.getByLabel("Fixkostenaktion").selectOption("fixed");
    await page.getByLabel("Priorität").fill("1");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();

    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Importkonto").selectOption("account-shared-checking");
    await page.getByLabel("Datumsspalte").fill("Date");
    await page.getByLabel("Betragsspalte").fill("Amount");
    await page.getByLabel("Beschreibungsspalte").fill("Description");
    await page.getByLabel("Kategoriespalte").fill("Category");
    await page.getByLabel("CSV-Datei").setInputFiles({
      name: "category-precedence.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date;Payee;Description;Amount;Category\n15.07.2026;Shop;Market mapped;-10,00;Ｓｏｎｓｔｉｇｅｓ\n16.07.2026;Shop;Market rule;-20,00;\n17.07.2026;Shop;Unknown fallback;-30,00;",
      ),
    });
    await page.getByRole("button", { name: "Importvorschau anzeigen" }).click();

    const mapped = page.getByRole("row").filter({ hasText: "Market mapped" });
    await expect(mapped.getByRole("cell", { name: "Sonstiges", exact: true })).toBeVisible();
    await expect(mapped.getByRole("cell", { name: "fix", exact: true })).toBeVisible();
    const ruled = page.getByRole("row").filter({ hasText: "Market rule" });
    await expect(ruled.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await expect(ruled.getByRole("cell", { name: "fix", exact: true })).toBeVisible();
    const fallback = page.getByRole("row").filter({ hasText: "Unknown fallback" });
    await expect(fallback.getByRole("cell", { name: "Sonstiges", exact: true })).toBeVisible();
    await expect(fallback.getByRole("cell", { name: "variabel", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-CAT-005-01: categorization rules can be created and listed", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/categorization-rules`);

    await expect(page.getByRole("heading", { name: "Kategorisierungsregeln" })).toBeVisible();

    await page.getByLabel("Regelname").fill("Groceries rule");
    await page.getByLabel("Suchtext").fill("supermarket");
    await page.getByLabel("Kategorie").selectOption("category-groceries");
    await page.getByLabel("Fixkostenaktion").selectOption("fixed");
    await page.getByLabel("Priorität").fill("10");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();

    await expect(page.getByRole("cell", { name: "Groceries rule", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "supermarket", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "als fix markieren", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-CAT-005-02: categorization reapplication reports changed and unchanged counts", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page
      .locator("#transaction-form")
      .getByLabel("Konto")
      .selectOption("account-shared-checking");
    await page.locator("#transaction-form").getByLabel("Kategorie").selectOption("category-other");
    await page.getByLabel("Datum").fill("01.07.2026");
    await page.getByLabel("Beschreibung").fill("Monthly landlord payment");
    await page.getByLabel("Betrag").fill("1.200,00");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Regelname").fill("Fixed rent rule");
    await page.getByLabel("Suchtext").fill("landlord");
    await page.getByLabel("Kategorie").selectOption("category-housing-rent");
    await page.getByLabel("Fixkostenaktion").selectOption("fixed");
    await page.getByLabel("Priorität").fill("1");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();
    await page
      .getByRole("button", { name: "Regeln auf bestehende Transaktionen anwenden" })
      .click();
    await expect(page.getByRole("status")).toContainText("1 geändert, 0 unverändert");

    await page.goto(`${baseUrl}/transactions`);
    const row = page.getByRole("row").filter({ hasText: "Monthly landlord payment" });
    await expect(row.getByRole("cell", { name: "Sonstiges", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "fix", exact: true })).toBeVisible();
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
    await page
      .locator("#transaction-form")
      .getByLabel("Konto")
      .selectOption("account-shared-checking");
    await page.locator("#transaction-form").getByLabel("Kategorie").selectOption("category-other");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page.getByLabel("Beschreibung").fill("Transfer settlement");
    await page.getByLabel("Betrag").fill("42,99");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Regelname").fill("Transfer reapply rule");
    await page.getByLabel("Suchtext").fill("settlement");
    await page.getByLabel("Kategorie").selectOption("category-other");
    await page.getByLabel("Umbuchungsaktion").selectOption("mark");
    await page.getByLabel("Priorität").fill("1");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();
    await page
      .getByRole("button", { name: "Regeln auf bestehende Transaktionen anwenden" })
      .click();

    await page.goto(`${baseUrl}/transactions`);
    let row = page.getByRole("row").filter({ hasText: "Transfer settlement" });
    await expect(row.getByRole("cell", { name: "Interne Umbuchung", exact: true })).toBeVisible();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page
      .getByRole("row")
      .filter({ hasText: "Transfer reapply rule" })
      .getByRole("link", { name: "Bearbeiten", exact: true })
      .click();
    await page.getByLabel("Umbuchungsaktion").selectOption("unmark");
    await page.getByRole("button", { name: "Regel speichern" }).click();
    await page
      .getByRole("button", { name: "Regeln auf bestehende Transaktionen anwenden" })
      .click();

    await page.goto(`${baseUrl}/transactions`);
    row = page.getByRole("row").filter({ hasText: "Transfer settlement" });
    await expect(row.getByRole("cell", { name: "Interne Umbuchung", exact: true })).toHaveCount(0);
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

    await page.getByLabel("Regelname").fill("Shared rent rule");
    await page.getByLabel("Suchtext").fill("landlord");
    await page.getByLabel("Kategorie").selectOption("category-housing-rent");
    await page.getByLabel("Konto").selectOption("account-shared-checking");
    await page.getByLabel("Priorität").fill("1");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();

    await expect(page.getByRole("cell", { name: "Shared rent rule", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Gemeinsames Girokonto", exact: true }),
    ).toBeVisible();
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
    await page.getByLabel("Regelname").fill("Old groceries rule");
    await page.getByLabel("Suchtext").fill("market");
    await page.getByLabel("Kategorie").selectOption("category-groceries");
    await page.getByLabel("Priorität").fill("10");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();

    await page
      .getByRole("row")
      .filter({ hasText: "Old groceries rule" })
      .getByRole("link", { name: "Bearbeiten", exact: true })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Kategorisierungsregel bearbeiten" }),
    ).toBeVisible();
    await page.getByLabel("Regelname").fill("Updated groceries rule");
    await page.getByLabel("Suchtext").fill("supermarket");
    await page.getByLabel("Priorität").fill("1");
    await page.getByRole("button", { name: "Regel speichern" }).click();

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
    await page.getByLabel("Regelname").fill("Delete groceries rule");
    await page.getByLabel("Suchtext").fill("market");
    await page.getByLabel("Kategorie").selectOption("category-groceries");
    await page.getByLabel("Priorität").fill("10");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();

    await page
      .getByRole("row")
      .filter({ hasText: "Delete groceries rule" })
      .getByRole("button", { name: "Löschen", exact: true })
      .click();

    await expect(page.getByText("Delete groceries rule")).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-CAT-002-01: categorization rules can be applied to persisted fallback transactions", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Importkonto").selectOption("account-shared-checking");
    await page.getByLabel("Datumsspalte").fill("Date");
    await page.getByLabel("Betragsspalte").fill("Amount");
    await page.getByLabel("Beschreibungsspalte").fill("Description");
    await page.getByLabel("CSV-Datei").setInputFiles({
      name: "fallback-reapplication.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date;Payee;Description;Amount\n15.07.2026;Market;Supermarket purchase;-42,99",
      ),
    });
    await page.getByRole("button", { name: "Importvorschau anzeigen" }).click();
    await page.getByRole("button", { name: "Import bestätigen" }).click();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Regelname").fill("Existing groceries rule");
    await page.getByLabel("Suchtext").fill("supermarket");
    await page.getByLabel("Kategorie").selectOption("category-groceries");
    await page.getByLabel("Priorität").fill("1");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();
    await page
      .getByRole("button", { name: "Regeln auf bestehende Transaktionen anwenden" })
      .click();

    await page.goto(`${baseUrl}/transactions`);
    await page
      .getByRole("row")
      .filter({ hasText: "Supermarket purchase" })
      .getByRole("link", { name: "Bearbeiten", exact: true })
      .click();

    await expect(page.locator("#transaction-form").getByLabel("Kategorie")).toHaveValue(
      "category-groceries",
    );
  } finally {
    await page.close();
    await server.close();
  }
});
