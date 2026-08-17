import { expect, test } from "@playwright/test";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("E2E-FF-LOC-005-01: each browser language renders and parses its own localized transaction page", async ({
  browser,
}) => {
  const repositories = createSeededInMemoryRepositories(createGermanLocalization());
  const server = buildServer({ repositories });

  try {
    const baseUrl = await listen(server);
    const germanContext = await browser.newContext({
      locale: "de-DE",
      extraHTTPHeaders: { "Accept-Language": "de-AT,de;q=0.9,en;q=0.8" },
    });
    const englishContext = await browser.newContext({
      locale: "en-GB",
      extraHTTPHeaders: { "Accept-Language": "en-GB,en;q=0.9" },
    });
    const germanPage = await germanContext.newPage();
    const englishPage = await englishContext.newPage();

    await loginAsTestUserPage(germanPage, baseUrl);
    const germanResponse = await germanPage.goto(`${baseUrl}/admin/master-data`);
    expect(germanResponse?.headers()["content-language"]).toBe("de-DE");
    expect(germanResponse?.headers().vary).toContain("Accept-Language");
    await expect(germanPage.locator("html")).toHaveAttribute("lang", "de-DE");
    await expect(germanPage.getByRole("heading", { name: "Stammdaten" })).toBeVisible();

    await germanPage.goto(`${baseUrl}/transactions`);
    await germanPage.getByLabel("Beschreibung").fill("German locale expense");
    await germanPage.getByLabel("Betrag").fill("1.234,56");
    await germanPage.getByLabel("Datum").fill("31.12.2026");
    await germanPage.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    await expect(germanPage.getByRole("cell", { name: "1.234,56", exact: true })).toBeVisible();

    await loginAsTestUserPage(englishPage, baseUrl);
    const englishResponse = await englishPage.goto(`${baseUrl}/transactions`);
    expect(englishResponse?.headers()["content-language"]).toBe("en");
    expect(englishResponse?.headers().vary).toContain("Accept-Language");
    await expect(englishPage.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      englishPage.getByRole("heading", { name: "Transactions", exact: true }),
    ).toBeVisible();
    await expect(englishPage.getByLabel("Amount")).toBeVisible();
    await expect(englishPage.getByLabel("Date")).toBeVisible();

    await englishPage.getByLabel("Description").fill("English locale expense");
    await englishPage.getByLabel("Amount").fill("1,234.56");
    await englishPage.getByLabel("Date").fill("12/31/2026");
    await englishPage.getByRole("button", { name: "Add transaction" }).click();

    await expect(
      englishPage
        .getByRole("row")
        .filter({ hasText: "English locale expense" })
        .getByRole("cell", { name: "1,234.56", exact: true }),
    ).toBeVisible();
    await expect(germanPage.getByRole("heading", { name: "Transaktionen" })).toBeVisible();
    await expect(germanPage.getByText("Transactions", { exact: true })).toHaveCount(0);

    await englishPage.getByLabel("Amount").fill("invalid");
    await englishPage.getByRole("button", { name: "Add transaction" }).click();
    await expect(englishPage.getByText("The transaction could not be saved.")).toBeVisible();
    await expect(englishPage.locator("body")).toContainText(/Request ID:/);

    await germanContext.close();
    await englishContext.close();

    await expect(repositories.transactions.list({})).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "German locale expense",
          amountCents: -123456,
          date: "2026-12-31",
        }),
        expect.objectContaining({
          description: "English locale expense",
          amountCents: -123456,
          date: "2026-12-31",
        }),
      ]),
    );
  } finally {
    await server.close();
  }
});
