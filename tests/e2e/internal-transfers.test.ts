import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("E2E-FF-TXN-005-03: transfer actions preserve active canonical filters", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);

    for (const description of ["Filtered transfer", "Other transaction"]) {
      await page.getByLabel("Beschreibung").fill(description);
      await page.getByLabel("Betrag").fill("10,00");
      await page.getByLabel("Datum").fill("15.07.2026");
      await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();
    }

    const otherRow = page.getByRole("row").filter({ hasText: "Other transaction" });
    await otherRow.getByRole("button", { name: "Als Umbuchung markieren" }).click();
    await page.getByLabel("Umbuchungsstatus").selectOption("unmarked");
    await page.getByRole("button", { name: "Filter anwenden" }).click();

    await expect(page.getByText("Filtered transfer")).toBeVisible();
    await expect(page.getByText("Other transaction")).toHaveCount(0);
    await page
      .getByRole("row")
      .filter({ hasText: "Filtered transfer" })
      .getByRole("button", { name: "Als Umbuchung markieren" })
      .click();

    await expect(page.getByText("Keine Transaktionen gefunden.")).toBeVisible();
    await expect(page.getByText("Other transaction")).toHaveCount(0);
    await expect(page.getByLabel("Umbuchungsstatus")).toHaveValue("unmarked");
  } finally {
    await server.close();
  }
});

test("E2E-FF-UI-001-02: transfer actions progressively enhance the transactions list", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Beschreibung").fill("Progressive transfer");
    await page.getByLabel("Betrag").fill("10,00");
    await page.getByLabel("Datum").fill("15.07.2026");
    await page.getByRole("button", { name: "Transaktion hinzufügen" }).click();

    const row = page.getByRole("row").filter({ hasText: "Progressive transfer" });
    const markForm = row.locator('form[action$="/internal-transfer"]');
    await expect(markForm).toHaveCount(1);
    await expect(markForm).toHaveAttribute("method", "post");
    await expect(markForm).toHaveAttribute("hx-post", /\/internal-transfer$/);
    await expect(markForm).toHaveAttribute("hx-target", "#transactions-list");
    await expect(markForm).toHaveAttribute("hx-swap", "outerHTML");

    const action = await markForm.getAttribute("action");
    if (action === null) throw new Error("Transfer action must have an action URL");

    const noJavaScriptResponse = await page.request.post(`${baseUrl}${action}`, {
      form: { internalTransfer: "true" },
      maxRedirects: 0,
    });
    expect(noJavaScriptResponse.status()).toBe(302);
    expect(noJavaScriptResponse.headers().location).toBe("/transactions");

    const htmxResponse = await page.request.post(`${baseUrl}${action}`, {
      headers: { "HX-Request": "true" },
      form: { internalTransfer: "true" },
    });
    expect(htmxResponse.status()).toBe(200);
    expect(await htmxResponse.text()).toMatch(
      /<section id="transactions-list"[\s\S]*Progressive transfer/,
    );
  } finally {
    await server.close();
  }
});
