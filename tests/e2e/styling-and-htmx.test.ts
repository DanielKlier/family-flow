import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage, loginAsTestUserRequest } from "../support/auth.js";
import { listen } from "../support/server.js";

test("E2E-FF-UI-002-01 transaction page includes the stylesheet and no inline style attributes", async ({
  request,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    const response = await request.get(`${baseUrl}/transactions`);
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain('<link rel="stylesheet" href="/assets/app.css">');
    expect(body).toContain('<a href="/imports/csv">CSV-Import</a>');
    expect(body).not.toMatch(/\sstyle=/i);
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-002-01 every delivered top-level page uses the shared stylesheet without inline styles", async ({
  request,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);

    for (const path of [
      "/",
      "/auth/login",
      "/transactions",
      "/admin/master-data",
      "/categorization-rules",
      "/income",
      "/imports/csv",
    ]) {
      const response = await request.get(`${baseUrl}${path}`);
      const body = await response.text();

      expect(response.status(), path).toBe(200);
      expect(body, path).toContain('<link rel="stylesheet" href="/assets/app.css">');
      expect(body, path).not.toMatch(/\sstyle=/i);
    }
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-001-01 income HTMX responses remain fragments while no-JavaScript forms redirect", async ({
  browser,
  request,
}) => {
  const server = buildServer();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    const fragment = await request.get(`${baseUrl}/income`, { headers: { "HX-Request": "true" } });
    const fragmentBody = await fragment.text();

    expect(fragment.status()).toBe(200);
    expect(fragmentBody).toContain('id="income-panel"');
    expect(fragmentBody).not.toContain("<!doctype html>");

    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/income`);
    await page.locator("#income-form").getByLabel("Bezeichnung").fill("No JS salary");
    await page.locator("#income-form").getByLabel("Betrag").fill("100,00");
    await page.locator("#income-form").getByLabel("Startmonat").fill("07.2026");
    await page.getByRole("button", { name: "Einnahme hinzufügen" }).click();

    await expect(page).toHaveURL(`${baseUrl}/income`);
    await expect(page.getByRole("cell", { name: "No JS salary", exact: true })).toBeVisible();
  } finally {
    await context.close();
    await server.close();
  }
});

test("E2E-FF-UI-001-01 transaction creation updates the list with HTMX without a full page reload", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.evaluate(() => {
      (window as unknown as { familyFlowPageMarker: string }).familyFlowPageMarker = "kept";
    });

    await page.getByLabel("Beschreibung").fill("HTMX groceries");
    await page.getByLabel("Betrag").fill("42,99");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    await expect(page.getByRole("cell", { name: "HTMX groceries", exact: true })).toBeVisible();
    await expect(page.locator("#transactions-list")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { familyFlowPageMarker?: string }).familyFlowPageMarker,
        ),
      )
      .toBe("kept");
  } finally {
    await server.close();
  }
});

test("transaction filters update the list with HTMX without a full page reload", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Beschreibung").fill("HTMX personal groceries");
    await page.getByLabel("Betrag").fill("42,99");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page
      .locator("#transaction-form")
      .getByLabel("Konto")
      .selectOption("account-person-a-checking");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page.getByLabel("Beschreibung").fill("HTMX shared rent");
    await page.getByLabel("Betrag").fill("1.200,00");
    await page.getByLabel("Datum").fill("01.07.2026");
    await page
      .locator("#transaction-form")
      .getByLabel("Konto")
      .selectOption("account-shared-checking");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page.evaluate(() => {
      (window as unknown as { familyFlowFilterMarker: string }).familyFlowFilterMarker = "kept";
    });

    await page.getByLabel("Eigentümer").selectOption("shared");
    await page.getByRole("button", { name: "Filter anwenden" }).click();

    await expect(page.getByRole("cell", { name: "HTMX shared rent", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "HTMX personal groceries", exact: true }),
    ).not.toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { familyFlowFilterMarker?: string }).familyFlowFilterMarker,
        ),
      )
      .toBe("kept");
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-003-01 transaction text is escaped in full-page and HTMX responses", async ({
  request,
}) => {
  const server = buildServer();
  const unsafeDescription = "<script>globalThis.familyFlowXss = true</script>";

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    const create = await request.post(`${baseUrl}/transactions`, {
      form: {
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "15.07.2026",
        description: unsafeDescription,
        amount: "42,99",
        status: "booked",
      },
    });
    expect(create.status()).toBe(200);

    const fullPage = await request.get(`${baseUrl}/transactions`);
    const fullBody = await fullPage.text();
    const fragment = await request.get(`${baseUrl}/transactions`, {
      headers: { "HX-Request": "true" },
    });
    const fragmentBody = await fragment.text();

    for (const body of [fullBody, fragmentBody]) {
      expect(body).toContain("&lt;script&gt;globalThis.familyFlowXss = true&lt;/script&gt;");
      expect(body).not.toContain("<script>globalThis.familyFlowXss = true</script>");
    }
    expect(fullBody).toContain("<!doctype html>");
    expect(fragmentBody).toContain('id="transactions-list"');
    expect(fragmentBody).not.toContain("<!doctype html>");
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-003-01 user-controlled content is escaped across master data, rules, income, and CSV pages", async ({
  request,
}) => {
  const server = buildServer();
  const unsafe = "<script>globalThis.familyFlowXss=true</script>";
  const escaped = "&lt;script&gt;globalThis.familyFlowXss=true&lt;/script&gt;";

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);

    const writes = [
      request.post(`${baseUrl}/admin/master-data/accounts`, {
        form: { name: unsafe, ownerContext: "shared" },
      }),
      request.post(`${baseUrl}/admin/master-data/categories`, { form: { name: unsafe } }),
      request.post(`${baseUrl}/categorization-rules`, {
        form: {
          name: unsafe,
          searchText: unsafe,
          categoryId: "category-groceries",
          accountId: "",
          fixedCost: "",
          priority: "1",
          enabled: "on",
        },
      }),
      request.post(`${baseUrl}/income`, {
        form: {
          name: unsafe,
          ownerContext: "person_a",
          amount: "1,00",
          startMonth: "07.2026",
          endMonth: "",
          active: "on",
        },
      }),
      request.post(`${baseUrl}/imports/csv/profiles`, {
        form: {
          profileName: unsafe,
          delimiter: ";",
          encoding: "utf8",
          dateFormat: "DD.MM.YYYY",
          decimalFormat: "comma-decimal",
          dateColumn: "Date",
          amountColumn: "Amount",
          descriptionColumn: "Description",
          payeeColumn: "Payee",
          purposeColumn: "",
          categoryColumn: "",
        },
      }),
    ];
    for (const response of await Promise.all(writes)) expect(response.status()).toBe(200);

    for (const path of ["/admin/master-data", "/categorization-rules", "/income", "/imports/csv"]) {
      const body = await (await request.get(`${baseUrl}${path}`)).text();
      expect(body, path).toContain(escaped);
      expect(body, path).not.toContain(unsafe);
    }
  } finally {
    await server.close();
  }
});

test("missing resources use the named shared-layout error view", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    for (const path of [
      "/admin/master-data/accounts/missing/edit",
      "/admin/master-data/categories/missing/edit",
      "/categorization-rules/missing/edit",
      "/income/missing/edit",
      "/transactions/missing/edit",
    ]) {
      const response = await request.get(`${baseUrl}${path}`);
      const body = await response.text();
      expect(response.status(), path).toBe(404);
      expect(body, path).toContain("<!doctype html>");
      expect(body, path).toContain('class="app-shell"');
      expect(body, path).toContain("nicht gefunden");
    }
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-003-01 unsafe CSV validation text is escaped", async ({ page }) => {
  const server = buildServer();
  const unsafeColumn = '<img src=x onerror="globalThis.familyFlowXss=true">';

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/imports/csv`);
    await page.getByLabel("Datumsspalte").fill(unsafeColumn);
    await page.getByLabel("Betragsspalte").fill("Amount");
    await page.getByLabel("Beschreibungsspalte").fill("Description");
    await page.getByLabel("CSV-Datei").setInputFiles({
      name: "unsafe-validation.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date;Amount;Description\n2026-07-15;-1.00;test"),
    });
    await page.getByRole("button", { name: "Importvorschau anzeigen" }).click();

    await expect(page.locator(".form-error")).toContainText(
      "Die CSV-Importvorschau ist fehlgeschlagen.",
    );
    expect(await page.content()).not.toContain(unsafeColumn);
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-001-01 transaction full-page and HTMX create, edit, delete, validation, and filter paths stay equivalent", async ({
  request,
}) => {
  const server = buildServer();
  const transaction = {
    accountId: "account-person-a-checking",
    categoryId: "category-groceries",
    date: "15.07.2026",
    description: "Parity transaction",
    amount: "10,00",
    status: "booked",
  };

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    const fullCreate = await request.post(`${baseUrl}/transactions`, {
      form: transaction,
      maxRedirects: 0,
    });
    const htmxCreate = await request.post(`${baseUrl}/transactions`, {
      form: { ...transaction, description: "HTMX parity transaction" },
      headers: { "HX-Request": "true" },
    });
    expect(fullCreate.status()).toBe(302);
    expect(await htmxCreate.text()).toContain('id="transactions-list"');

    const pageBody = await (await request.get(`${baseUrl}/transactions`)).text();
    const id = pageBody.match(/\/transactions\/([^/]+)\/edit[^>]*>Bearbeiten<\/a>/)?.[1];
    expect(id).toBeDefined();
    const update = { ...transaction, description: "Updated parity transaction" };
    expect(
      (
        await request.post(`${baseUrl}/transactions/${id}`, {
          form: update,
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(302);
    const htmxEdit = await request.post(`${baseUrl}/transactions/${id}`, {
      form: update,
      headers: { "HX-Request": "true" },
    });
    expect(await htmxEdit.text()).toContain('id="transactions-panel"');

    const invalid = { ...transaction, amount: "unsafe" };
    const fullInvalid = await request.post(`${baseUrl}/transactions`, { form: invalid });
    const htmxInvalid = await request.post(`${baseUrl}/transactions`, {
      form: invalid,
      headers: { "HX-Request": "true" },
    });
    expect(fullInvalid.status()).toBe(400);
    expect(await fullInvalid.text()).toContain("<!doctype html>");
    expect(htmxInvalid.status()).toBe(400);
    expect(await htmxInvalid.text()).not.toContain("<!doctype html>");

    const fullFilter = await request.get(`${baseUrl}/transactions?ownerContext=person_a`);
    const htmxFilter = await request.get(`${baseUrl}/transactions?ownerContext=person_a`, {
      headers: { "HX-Request": "true" },
    });
    expect(await fullFilter.text()).toContain("Updated parity transaction");
    expect(await htmxFilter.text()).toContain("Updated parity transaction");

    expect(
      (await request.post(`${baseUrl}/transactions/${id}/delete`, { maxRedirects: 0 })).status(),
    ).toBe(302);
    const remainingBody = await (await request.get(`${baseUrl}/transactions`)).text();
    const remainingId = remainingBody.match(
      /\/transactions\/([^/]+)\/edit[^>]*>Bearbeiten<\/a>/,
    )?.[1];
    expect(remainingId).toBeDefined();
    const htmxDelete = await request.post(`${baseUrl}/transactions/${remainingId}/delete`, {
      headers: { "HX-Request": "true" },
    });
    expect(await htmxDelete.text()).toContain('id="transactions-list"');
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-001-01 browser-driven HTMX income and transaction edits handle success and validation", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);

    await page.goto(`${baseUrl}/income`);
    await page.locator("#income-form").getByLabel("Bezeichnung").fill("Browser income");
    await page.locator("#income-form").getByLabel("Betrag").fill("100,00");
    await page.locator("#income-form").getByLabel("Startmonat").fill("01.2026");
    await page.getByRole("button", { name: "Einnahme hinzufügen" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Browser income" })
      .getByRole("link", { name: "Bearbeiten" })
      .click();
    await page.evaluate(() => {
      (window as unknown as { editMarker: string }).editMarker = "kept";
    });
    await page.getByLabel("Bezeichnung").fill("Browser income edited");
    await page.getByRole("button", { name: "Einnahme speichern" }).click();
    await expect(
      page.getByRole("cell", { name: "Browser income edited", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { editMarker?: string }).editMarker))
      .toBe("kept");
    await page
      .getByRole("row")
      .filter({ hasText: "Browser income edited" })
      .getByRole("link", { name: "Bearbeiten" })
      .click();
    await page.getByLabel("Betrag").fill("unsafe");
    await page.getByRole("button", { name: "Einnahme speichern" }).click();
    await expect(page.locator("#income-panel .form-error")).toContainText(
      "Der Betrag ist ungültig.",
    );

    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Beschreibung").fill("Browser transaction");
    await page.getByLabel("Betrag").fill("10,00");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Browser transaction" })
      .getByRole("link", { name: "Bearbeiten" })
      .click();
    await page.getByLabel("Beschreibung").fill("Browser transaction edited");
    await page.getByRole("button", { name: "Transaktion speichern" }).click();
    await expect(
      page.getByRole("cell", { name: "Browser transaction edited", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: "Browser transaction edited" })
      .getByRole("link", { name: "Bearbeiten" })
      .click();
    await page.getByLabel("Betrag").fill("unsafe");
    await page.getByRole("button", { name: "Transaktion speichern" }).click();
    await expect(page.locator("#transactions-panel .form-error")).toContainText(
      "Der Betrag ist ungültig.",
    );
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-001-01 income full-page and HTMX create, edit, validation, and filter paths stay equivalent", async ({
  request,
}) => {
  const server = buildServer();
  const income = {
    name: "Parity income",
    ownerContext: "person_a",
    amount: "100,00",
    startMonth: "01.2026",
    endMonth: "",
    active: "on",
  };

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);
    expect(
      (await request.post(`${baseUrl}/income`, { form: income, maxRedirects: 0 })).status(),
    ).toBe(302);
    const htmxCreate = await request.post(`${baseUrl}/income`, {
      form: { ...income, name: "HTMX parity income" },
      headers: { "HX-Request": "true" },
    });
    expect(await htmxCreate.text()).toContain('id="income-panel"');

    const body = await (await request.get(`${baseUrl}/income`)).text();
    const id = body.match(/\/income\/([^/]+)\/edit[^>]*>Bearbeiten<\/a>/)?.[1];
    expect(id).toBeDefined();
    const htmxEdit = await request.post(`${baseUrl}/income/${id}`, {
      form: { ...income, name: "Updated parity income" },
      headers: { "HX-Request": "true" },
    });
    expect(await htmxEdit.text()).toContain('id="income-panel"');
    expect(await htmxEdit.text()).not.toContain("<!doctype html>");

    const invalid = { ...income, amount: "unsafe" };
    const fullInvalid = await request.post(`${baseUrl}/income`, { form: invalid });
    const htmxInvalid = await request.post(`${baseUrl}/income`, {
      form: invalid,
      headers: { "HX-Request": "true" },
    });
    expect(fullInvalid.status()).toBe(400);
    expect(await fullInvalid.text()).toContain("<!doctype html>");
    expect(htmxInvalid.status()).toBe(400);
    expect(await htmxInvalid.text()).not.toContain("<!doctype html>");

    const fullFilter = await request.get(`${baseUrl}/income?month=07.2026&ownerContext=person_a`);
    const htmxFilter = await request.get(`${baseUrl}/income?month=07.2026&ownerContext=person_a`, {
      headers: { "HX-Request": "true" },
    });
    expect(await fullFilter.text()).toContain("Updated parity income");
    expect(await htmxFilter.text()).toContain("Updated parity income");
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-001-01 no-JavaScript master-data, rule, and income operations include validation and filtering", async ({
  browser,
}) => {
  const server = buildServer();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);

    await page.goto(`${baseUrl}/admin/master-data`);
    await page.getByLabel("Neuer Kategoriename").fill("No JS category");
    await page.getByRole("button", { name: "Kategorie hinzufügen" }).click();
    const categoryRow = page.getByRole("row").filter({ hasText: "No JS category" });
    await categoryRow.getByRole("link", { name: "Kategorie bearbeiten" }).click();
    await page.getByLabel("Kategoriename").fill("No JS category edited");
    await page.getByRole("button", { name: "Kategorie speichern" }).click();
    await page.getByLabel("Neuer Kategoriename").fill("   ");
    await page.getByRole("button", { name: "Kategorie hinzufügen" }).click();
    await expect(page.locator(".form-error")).toContainText("Kategoriename ist erforderlich.");
    await page
      .getByRole("row")
      .filter({ hasText: "No JS category edited" })
      .getByRole("button", { name: "Kategorie deaktivieren" })
      .click();

    await page.goto(`${baseUrl}/categorization-rules`);
    await page.getByLabel("Regelname").fill("No JS rule");
    await page.getByLabel("Suchtext").fill("no-js");
    await page.getByLabel("Priorität").fill("1");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();
    const ruleRow = page.getByRole("row").filter({ hasText: "No JS rule" });
    await ruleRow.getByRole("link", { name: "Bearbeiten", exact: true }).click();
    await page.getByLabel("Regelname").fill("No JS rule edited");
    await page.getByRole("button", { name: "Regel speichern" }).click();
    await page.getByLabel("Regelname").fill("Invalid rule");
    await page.getByLabel("Suchtext").fill("invalid");
    await page.getByLabel("Priorität").fill("-1");
    await page.getByRole("button", { name: "Regel hinzufügen" }).click();
    await expect(page.getByLabel("Priorität")).toBeFocused();
    expect(
      await page
        .getByLabel("Priorität")
        .evaluate((input: HTMLInputElement) => input.validity.valid),
    ).toBe(false);
    await page
      .getByRole("row")
      .filter({ hasText: "No JS rule edited" })
      .getByRole("button", { name: "Löschen", exact: true })
      .click();

    await page.goto(`${baseUrl}/income`);
    await page.getByLabel("Bezeichnung").fill("No JS income A");
    await page.getByLabel("Betrag").first().fill("100,00");
    await page.getByLabel("Startmonat").fill("01.2026");
    await page.getByRole("button", { name: "Einnahme hinzufügen" }).click();
    await page.getByLabel("Bezeichnung").fill("No JS income B");
    await page.locator("#income-form").getByLabel("Eigentümer").selectOption("person_b");
    await page.getByLabel("Betrag").first().fill("200,00");
    await page.getByLabel("Startmonat").fill("01.2026");
    await page.getByRole("button", { name: "Einnahme hinzufügen" }).click();
    await page.getByLabel("Eigentümer filtern").selectOption("person_b");
    await page.getByRole("button", { name: "Einnahmen filtern" }).click();
    await expect(page.getByRole("cell", { name: "No JS income B", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "No JS income A", exact: true })).not.toBeVisible();
    await page.getByRole("link", { name: "Bearbeiten" }).click();
    await page.getByLabel("Bezeichnung").fill("No JS income B edited");
    await page.getByRole("button", { name: "Einnahme speichern" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "No JS income B edited" })
      .getByRole("link", { name: "Bearbeiten" })
      .click();
    await page.getByLabel("Betrag").fill("unsafe");
    await page.getByRole("button", { name: "Einnahme speichern" }).click();
    await expect(page.locator(".form-error")).toContainText("Der Betrag ist ungültig.");
    await expect(page.locator("#income-panel")).toBeVisible();
  } finally {
    await context.close();
    await server.close();
  }
});

test("E2E-FF-UI-001-01 transaction form remains usable without JavaScript", async ({ browser }) => {
  const server = buildServer();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Beschreibung").fill("No JS groceries");
    await page.getByLabel("Betrag").fill("42,99");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page
      .locator("#transaction-form")
      .getByLabel("Konto")
      .selectOption("account-person-a-checking");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    await expect(page).toHaveURL(`${baseUrl}/transactions`);
    await expect(page.getByRole("cell", { name: "No JS groceries", exact: true })).toBeVisible();
    await page.getByLabel("Eigentümer").selectOption("person_a");
    await page.getByRole("button", { name: "Filter anwenden" }).click();
    await expect(page.getByRole("cell", { name: "No JS groceries", exact: true })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "No JS groceries" });
    await row.getByRole("link", { name: "Bearbeiten", exact: true }).click();
    await page.getByLabel("Beschreibung").fill("No JS groceries edited");
    await page.getByRole("button", { name: "Transaktion speichern" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "No JS groceries edited" })
      .getByRole("link", { name: "Bearbeiten" })
      .click();
    await page.getByLabel("Betrag").fill("unsafe");
    await page.getByRole("button", { name: "Transaktion speichern" }).click();
    await expect(page.locator(".form-error")).toContainText("Der Betrag ist ungültig.");
    await expect(page.locator("#transactions-panel")).toBeVisible();
    await page.goto(`${baseUrl}/transactions`);
    await page
      .getByRole("row")
      .filter({ hasText: "No JS groceries edited" })
      .getByRole("button", { name: "Löschen", exact: true })
      .click();
    await expect(page.getByText("No JS groceries edited", { exact: true })).not.toBeVisible();
  } finally {
    await context.close();
    await server.close();
  }
});
