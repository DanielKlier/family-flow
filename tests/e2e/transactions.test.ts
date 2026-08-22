import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("E2E-FF-TXN-002-01: a manual booked expense displays its localized one-time amount", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page
      .locator("#transaction-form")
      .getByLabel("Kategorie")
      .selectOption("category-groceries");
    await page.getByLabel("Beschreibung").fill("Groceries");
    await page.getByLabel("Betrag").fill("42,99");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page.locator("#transaction-form").getByLabel("Status").selectOption("booked");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    await expect(page.getByRole("cell", { name: "Groceries", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Kategorie" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Lebensmittel", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "gebucht", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "42,99", exact: true })).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: "Groceries" });
    await expect(row.getByRole("link", { name: "Bearbeiten", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Löschen", exact: true })).toBeVisible();
    await expect(row.getByRole("link", { name: "Edit Groceries" })).not.toBeVisible();
    await expect(row.getByRole("button", { name: "Delete Groceries" })).not.toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-TXN-002-02: forged account and category references are rejected without mutation", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);

    for (const [field, value, error] of [
      ["Datum", "30.02.2026", "Das Datum ist ungültig."],
      ["Betrag", "-1,00", "Der Betrag ist ungültig."],
      ["Betrag", "0", "Der Betrag ist ungültig."],
      ["Betrag", "1,234", "Der Betrag ist ungültig."],
      ["Betrag", "90.071.992.547.409,92", "Der Betrag ist ungültig."],
    ]) {
      await page.goto(`${baseUrl}/transactions`);
      await page.getByLabel("Beschreibung").fill(`Invalid ${value}`);
      await page.getByLabel("Betrag").fill(field === "Betrag" ? value : "1,00");
      await page.getByLabel("Datum").fill(field === "Datum" ? value : "15.07.2026");

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url() === `${baseUrl}/transactions` && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
      const response = await responsePromise;

      expect(response.status()).toBe(400);
      expect(response.headers()["x-request-id"]).toBeTruthy();
      await expect(page.getByText(error, { exact: false })).toBeVisible();
      await expect(
        page.getByText(response.headers()["x-request-id"], { exact: false }),
      ).toBeVisible();
      await expect(page.getByRole("cell", { name: `Invalid ${value}`, exact: true })).toHaveCount(
        0,
      );
    }

    for (const [field, value, error] of [
      ["Konto", "account-does-not-exist", "Das Konto ist nicht vorhanden."],
      ["Kategorie", "category-does-not-exist", "Die Kategorie ist nicht vorhanden."],
    ]) {
      await page.goto(`${baseUrl}/transactions`);
      const select = page.locator("#transaction-form").getByLabel(field);
      await select.evaluate((element, unknownValue) => {
        const option = document.createElement("option");
        option.value = unknownValue;
        option.text = unknownValue;
        element.append(option);
      }, value);
      await select.selectOption(value);
      await page.getByLabel("Beschreibung").fill(`Forged ${field}`);
      await page.getByLabel("Betrag").fill("1,00");
      await page.getByLabel("Datum").fill("15.07.2026");

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url() === `${baseUrl}/transactions` && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
      const response = await responsePromise;

      expect(response.status()).toBe(400);
      expect(response.headers()["x-request-id"]).toBeTruthy();
      await expect(page.getByText(error, { exact: false })).toBeVisible();
      await expect(
        page.getByText(response.headers()["x-request-id"], { exact: false }),
      ).toBeVisible();
      await expect(page.getByRole("cell", { name: `Forged ${field}`, exact: true })).toHaveCount(0);
    }
  } finally {
    await server.close();
  }
});

test("E2E-FF-TXN-003-01: every transaction filter and required filter pair excludes nonmatches", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    for (const transaction of [
      {
        description: "July personal groceries",
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "15.07.2026",
        status: "booked",
        fixedCost: false,
      },
      {
        description: "August shared rent",
        accountId: "account-shared-checking",
        categoryId: "category-housing-rent",
        date: "01.08.2026",
        status: "planned",
        fixedCost: true,
      },
    ]) {
      await page
        .locator("#transaction-form")
        .getByLabel("Konto")
        .selectOption(transaction.accountId);
      await page
        .locator("#transaction-form")
        .getByLabel("Kategorie")
        .selectOption(transaction.categoryId);
      await page.getByLabel("Beschreibung").fill(transaction.description);
      await page.getByLabel("Betrag").fill("1,00");
      await page.getByLabel("Datum").fill(transaction.date.split("-").reverse().join("."));
      await page.locator("#transaction-form").getByLabel("Status").selectOption(transaction.status);
      if (transaction.fixedCost)
        await page.locator("#transaction-form").getByLabel("Fixkosten").check();
      await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    }

    const filters = [
      {
        values: { Monat: "2026-07" },
        expected: "July personal groceries",
        excluded: "August shared rent",
      },
      {
        values: { Konto: "account-person-a-checking" },
        expected: "July personal groceries",
        excluded: "August shared rent",
      },
      {
        values: { Eigentümer: "shared" },
        expected: "August shared rent",
        excluded: "July personal groceries",
      },
      {
        values: { Kategorie: "category-groceries" },
        expected: "July personal groceries",
        excluded: "August shared rent",
      },
      {
        values: { Status: "planned" },
        expected: "August shared rent",
        excluded: "July personal groceries",
      },
      {
        values: { Kostenart: "fixed" },
        expected: "August shared rent",
        excluded: "July personal groceries",
      },
      {
        values: { Monat: "2026-08", Konto: "account-shared-checking" },
        expected: "August shared rent",
        excluded: "July personal groceries",
      },
      {
        values: { Eigentümer: "person_a", Kategorie: "category-groceries" },
        expected: "July personal groceries",
        excluded: "August shared rent",
      },
      {
        values: { Status: "planned", Kostenart: "fixed" },
        expected: "August shared rent",
        excluded: "July personal groceries",
      },
    ];

    for (const filter of filters) {
      await page.goto(`${baseUrl}/transactions`);
      for (const [label, value] of Object.entries(filter.values)) {
        const filtersForm = page.locator("#transaction-filters");
        const control =
          label === "Status"
            ? filtersForm.locator('select[name="status"]')
            : filtersForm.getByLabel(label);
        if (label === "Monat") {
          await control.fill(value);
        } else {
          await control.selectOption(value);
        }
      }
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().startsWith(`${baseUrl}/transactions?`) && response.status() === 200,
      );
      await page.getByRole("button", { name: "Filter anwenden" }).click();
      await responsePromise;
      await expect(page.getByRole("cell", { name: filter.expected, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: filter.excluded, exact: true })).toHaveCount(0);
    }
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
    await page.getByLabel("Beschreibung").fill("Transfer to savings");
    await page.getByLabel("Betrag").fill("100,00");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    const row = page.getByRole("row").filter({ hasText: "Transfer to savings" });
    const markButton = row.getByRole("button", { name: "Als Umbuchung markieren", exact: true });
    await expect(markButton).toHaveCount(1);
    await markButton.click();
    await expect(row.getByText("Interne Umbuchung", { exact: true })).toBeVisible();

    await page.getByLabel("Umbuchungsstatus").selectOption("marked");
    await page.getByRole("button", { name: "Filter anwenden" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Transfer to savings" })).toBeVisible();

    await page
      .getByRole("row")
      .filter({ hasText: "Transfer to savings" })
      .getByRole("button", { name: "Umbuchung aufheben", exact: true })
      .click();
    await page.getByLabel("Umbuchungsstatus").selectOption("unmarked");
    await page.getByRole("button", { name: "Filter anwenden" }).click();
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
    await page.getByLabel("Importkonto").selectOption("account-shared-checking");
    await page.getByLabel("Datumsspalte").fill("Date");
    await page.getByLabel("Betragsspalte").fill("Amount");
    await page.getByLabel("Beschreibungsspalte").fill("Description");
    await page.getByLabel("Zahlungsempfängerspalte").fill("Payee");
    await page.getByLabel("CSV-Datei").setInputFiles({
      name: "internal-transfer.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date;Payee;Description;Amount\n15.07.2026;Bank;Imported transfer;-100,00",
      ),
    });
    await page.getByRole("button", { name: "Importvorschau anzeigen" }).click();
    await page.getByRole("button", { name: "Import bestätigen" }).click();

    const row = page.getByRole("row").filter({ hasText: "Imported transfer" });
    const markButton = row.getByRole("button", { name: "Als Umbuchung markieren", exact: true });
    await expect(markButton).toHaveCount(1);
    await markButton.click();
    await expect(page.getByRole("row").filter({ hasText: "Imported transfer" })).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: "Imported transfer" })
      .getByRole("button", { name: "Umbuchung aufheben", exact: true })
      .click();
    await expect(page.getByRole("row").filter({ hasText: "Imported transfer" })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("purpose is visible in the transaction list after CSV import", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Importkonto").selectOption("account-shared-checking");
    await page.getByLabel("Datumsspalte").fill("Date");
    await page.getByLabel("Betragsspalte").fill("Amount");
    await page.getByLabel("Beschreibungsspalte").fill("Description");
    await page.getByLabel("Zahlungsempfängerspalte").fill("Payee");
    await page.getByLabel("Verwendungszweckspalte").fill("Purpose");
    await page.getByLabel("CSV-Datei").setInputFiles({
      name: "purpose.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date;Payee;Description;Purpose;Amount\n15.07.2026;Supermarket;Card payment;Monthly groceries;-42,99",
      ),
    });
    await page.getByRole("button", { name: "Importvorschau anzeigen" }).click();
    await page.getByRole("button", { name: "Import bestätigen" }).click();

    await expect(
      page.getByRole("columnheader", { name: "Verwendungszweck", exact: true }),
    ).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Card payment" });
    await expect(row.getByRole("cell", { name: "Card payment", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "Monthly groceries", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-TXN-002-01: a planned expense displays its localized one-time amount", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Beschreibung").fill("Planned rent");
    await page.getByLabel("Betrag").fill("1.200,00");
    await page.getByLabel("Datum").fill("01.07.2026");
    await page.locator("#transaction-form").getByLabel("Status").selectOption("planned");
    await page.locator("#transaction-form").getByLabel("Fixkosten").check();
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    await expect(page.getByRole("cell", { name: "Planned rent", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "1.200,00", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "geplant", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "fix", exact: true })).toBeVisible();
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
    await page.getByLabel("Beschreibung").fill("Old description");
    await page.getByLabel("Betrag").fill("10,00");
    await page.getByLabel("Datum").fill("10.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Old description" })
      .getByRole("link", { name: "Bearbeiten", exact: true })
      .click();
    await page.getByLabel("Beschreibung").fill("Updated description");
    await page.getByRole("button", { name: "Transaktion speichern" }).click();

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
    await page.getByLabel("Beschreibung").fill("Delete me");
    await page.getByLabel("Betrag").fill("10,00");
    await page.getByLabel("Datum").fill("10.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Delete me" })
      .getByRole("button", { name: "Löschen", exact: true })
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
    await page.getByLabel("Beschreibung").fill("Personal groceries");
    await page.getByLabel("Betrag").fill("42,99");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page
      .locator("#transaction-form")
      .getByLabel("Konto")
      .selectOption("account-person-a-checking");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page.getByLabel("Beschreibung").fill("Shared rent");
    await page.getByLabel("Betrag").fill("1.200,00");
    await page.getByLabel("Datum").fill("01.07.2026");
    await page
      .locator("#transaction-form")
      .getByLabel("Konto")
      .selectOption("account-shared-checking");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    await page.getByLabel("Eigentümer").selectOption("shared");
    await page.getByRole("button", { name: "Filter anwenden" }).click();

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
    await page.getByLabel("Beschreibung").fill("Variable groceries");
    await page.getByLabel("Betrag").fill("42,99");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page.getByLabel("Beschreibung").fill("Fixed rent");
    await page.getByLabel("Betrag").fill("1.200,00");
    await page.getByLabel("Datum").fill("01.07.2026");
    await page.locator("#transaction-form").getByLabel("Fixkosten").check();
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    await page.getByLabel("Kostenart").selectOption("fixed");
    await page.getByRole("button", { name: "Filter anwenden" }).click();

    await expect(page.getByRole("cell", { name: "Fixed rent", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Variable groceries", exact: true }),
    ).not.toBeVisible();
  } finally {
    await server.close();
  }
});
