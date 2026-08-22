import { expect, test } from "@playwright/test";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";
import { aTransaction } from "../support/transactions.js";

const julyClock = { now: () => new Date(2026, 6, 10, 12, 0, 0) };

async function scenarioFixture() {
  const repositories = createSeededInMemoryRepositories(createGermanLocalization());
  for (const transaction of [
    aTransaction({ id: "scenario-april", date: "2026-04-02", amountCents: -30_000 }),
    aTransaction({ id: "scenario-june", date: "2026-06-02", amountCents: -60_000 }),
    aTransaction({
      id: "scenario-transfer",
      date: "2026-05-02",
      amountCents: -90_000,
      internalTransfer: true,
    }),
  ]) {
    await repositories.transactions.save(transaction);
  }
  return repositories;
}

test("E2E-FF-SCN-001-01 E2E-FF-SCN-001-02 E2E-FF-SCN-003-01 E2E-FF-SCN-004-01 E2E-FF-LOC-001-03 E2E-FF-UI-001-03 creates immutable localized scenario plans and renders HTMX-compatible results", async ({
  page,
}) => {
  const repositories = await scenarioFixture();
  const server = buildServer({ repositories, clock: julyClock });

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/scenarios`);

    await expect(page.getByRole("heading", { name: "Familienfinanzszenarien" })).toBeVisible();
    const form = page.locator("#scenario-form");
    await form.getByLabel("Bezeichnung").fill("Elternzeit 2026");
    await form.getByLabel("Startmonat").fill("08.2026");
    await form.getByLabel("Endmonat").fill("01.2028");
    await form.getByLabel("Startpuffer").fill("1.000,00");
    await form.getByLabel("Monatliche Einnahmen").fill("3.000,00");
    await form.getByLabel("Ausgabenbasis").selectOption("historical-3");
    await form.getByRole("button", { name: "Szenario speichern" }).click();

    const panel = page.locator("#scenario-panel");
    await expect(panel).toContainText("Elternzeit 2026");
    await expect(panel).toContainText("300,00");
    await expect(panel).toContainText("Niedrigster Puffer");
    await expect(panel).toContainText("Zusätzlich benötigtes Nettoeinkommen");

    for (const adjustment of [
      ["Elternzeit", "income", "decrease", "1.000,00"],
      ["Elterngeld", "income", "increase", "1.200,00"],
      ["Teilzeiteinkommen", "income", "increase", "800,00"],
      ["Kindergeld", "income", "increase", "250,00"],
      ["Kindkosten", "expense", "increase", "400,00"],
      ["Kita-Kosten", "expense", "increase", "500,00"],
    ]) {
      const [name, type, direction, amount] = adjustment;
      const adjustmentForm = page.locator("#scenario-adjustment-form");
      await adjustmentForm.getByLabel("Bezeichnung").fill(name);
      await adjustmentForm.getByLabel("Art").selectOption(type);
      await adjustmentForm.getByLabel("Änderung").selectOption(direction);
      await adjustmentForm.getByLabel("Betrag").fill(amount);
      await adjustmentForm.getByLabel("Von Monat").fill("08.2026");
      await adjustmentForm.getByLabel("Bis Monat").fill("01.2028");
      await adjustmentForm.getByRole("button", { name: "Anpassung hinzufügen" }).click();
    }
    await expect(panel).toContainText("Elternzeit");
    await expect(panel).toContainText("Kita-Kosten");
    await expect(panel).not.toContainText(/Steuer|gesetzlich/i);

    const baselineBeforeMutation = await panel.getByText("Ausgabenbasis").textContent();
    const source = await repositories.transactions.get("scenario-april");
    if (source === null) throw new Error("Scenario transaction fixture must exist");
    await repositories.transactions.save({
      ...source,
      amountCents: -999_999,
      description: "Changed",
    });
    await page.reload();
    await expect(panel.getByText("Ausgabenbasis")).toHaveText(baselineBeforeMutation ?? "");

    const htmxResponse = await page.request.get(`${baseUrl}/scenarios`, {
      headers: { "HX-Request": "true" },
    });
    expect(htmxResponse.status()).toBe(200);
    await expect(htmxResponse.text()).resolves.toContain('id="scenario-panel"');
    await expect(htmxResponse.text()).resolves.not.toContain("<!doctype html>");
  } finally {
    await server.close();
  }
});

test("E2E-FF-SCN-006-01 exposes exactly the authenticated calculator help links", async ({
  page,
}) => {
  const server = buildServer({ clock: julyClock });

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/calculators`);

    await expect(page.getByRole("heading", { name: "Rechner und Hilfen" })).toBeVisible();
    await expect(page.locator("main a[href^='https://']")).toHaveCount(2);
    await expect(
      page.locator(
        "main a[href='https://familienportal.de/familienportal/rechner-antraege/elterngeldrechner']",
      ),
    ).toHaveCount(1);
    await expect(page.locator("main a[href='https://www.bmf-steuerrechner.de']")).toHaveCount(1);
  } finally {
    await server.close();
  }
});
