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
    await incomeForm.getByLabel("Bezeichnung").fill("Salary Person A");
    await incomeForm.getByLabel("Eigentümer").selectOption("person_a");
    await incomeForm.getByLabel("Betrag").fill("3.500,00");
    await incomeForm.getByLabel("Startmonat").fill("01.2026");
    await incomeForm.getByRole("button", { name: "Einnahme hinzufügen" }).click();

    await expect(page.getByRole("cell", { name: "Salary Person A", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Person A", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "3.500,00", exact: true })).toBeVisible();
    await expect(page.getByText("Geplante Monatseinnahmen: 3.500,00")).toBeVisible();
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

    await expect(page.locator("#income-form").getByLabel("Startmonat")).toHaveAttribute(
      "placeholder",
      "MM.JJJJ",
    );
    await expect(page.locator("#income-form").getByLabel("Endmonat")).toHaveAttribute(
      "placeholder",
      "MM.JJJJ",
    );
    await expect(page.locator("#income-override-form").getByLabel("Monat")).toHaveAttribute(
      "placeholder",
      "MM.JJJJ",
    );
    await expect(page.locator("#income-filters").getByLabel("Berechnungsmonat")).toHaveAttribute(
      "placeholder",
      "MM.JJJJ",
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
    await incomeForm.getByLabel("Bezeichnung").fill("Salary Person A");
    await incomeForm.getByLabel("Betrag").fill("3.500,00");
    await incomeForm.getByLabel("Startmonat").fill("01.2026");
    await incomeForm.getByRole("button", { name: "Einnahme hinzufügen" }).click();
    const overrideForm = page.locator("#income-override-form");
    await overrideForm.getByLabel("Einnahme").selectOption({ label: "Salary Person A" });
    await overrideForm.getByLabel("Monat").fill("08.2026");
    await overrideForm.getByLabel("Abweichender Betrag").fill("1.800,00");
    await overrideForm.getByLabel("Notiz zur Abweichung").fill("Reduced salary");
    await page.getByRole("button", { name: "Abweichung speichern" }).click();
    await page.getByLabel("Berechnungsmonat").fill("08.2026");
    await page.getByRole("button", { name: "Berechnung aktualisieren" }).click();

    await expect(page.getByRole("cell", { name: "Reduced salary", exact: true })).toBeVisible();
    await expect(page.getByText("Geplante Monatseinnahmen: 1.800,00")).toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-INC-001-01 E2E-FF-INC-001-02 E2E-FF-INC-003-01 E2E-FF-INC-005-01 deactivation excludes a plan and reactivation preserves its override", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/income`);
    const incomeForm = page.locator("#income-form");
    await incomeForm.getByLabel("Bezeichnung").fill("Retained salary");
    await incomeForm.getByLabel("Eigentümer").selectOption("person_a");
    await incomeForm.getByLabel("Betrag").fill("3.500,00");
    await incomeForm.getByLabel("Startmonat").fill("01.2026");
    await incomeForm.getByRole("button", { name: "Einnahme hinzufügen" }).click();

    const overrideForm = page.locator("#income-override-form");
    await overrideForm.getByLabel("Einnahme").selectOption({ label: "Retained salary" });
    await overrideForm.getByLabel("Monat").fill("08.2026");
    await overrideForm.getByLabel("Abweichender Betrag").fill("0,00");
    await overrideForm.getByRole("button", { name: "Abweichung speichern" }).click();
    await page.getByLabel("Berechnungsmonat").fill("08.2026");
    await page.getByRole("button", { name: "Berechnung aktualisieren" }).click();

    await expect(page.getByText("Geplante Monatseinnahmen: 0,00")).toBeVisible();
    await expect(
      page
        .locator("section[aria-labelledby='income-list-heading']")
        .getByRole("cell", { name: "Retained salary", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Deaktivieren" })).toBeVisible();
    await page.getByRole("button", { name: "Deaktivieren" }).click();
    await page.getByLabel("Berechnungsmonat").fill("01.2026");
    await page.getByRole("button", { name: "Berechnung aktualisieren" }).click();
    await expect(page.getByText("Geplante Monatseinnahmen: 0,00")).toBeVisible();
    await expect(page.getByRole("button", { name: "Aktivieren" })).toBeVisible();

    await page.getByRole("button", { name: "Aktivieren" }).click();
    await page.getByLabel("Berechnungsmonat").fill("01.2026");
    await page.getByRole("button", { name: "Berechnung aktualisieren" }).click();
    await expect(page.getByText("Geplante Monatseinnahmen: 3.500,00")).toBeVisible();
    await page.getByLabel("Berechnungsmonat").fill("08.2026");
    await page.getByRole("button", { name: "Berechnung aktualisieren" }).click();
    await expect(page.getByText("Geplante Monatseinnahmen: 0,00")).toBeVisible();
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
    await incomeForm.getByLabel("Bezeichnung").fill("Salary Person A");
    await incomeForm.getByLabel("Eigentümer").selectOption("person_a");
    await incomeForm.getByLabel("Betrag").fill("3.500,00");
    await incomeForm.getByLabel("Startmonat").fill("01.2026");
    await incomeForm.getByRole("button", { name: "Einnahme hinzufügen" }).click();
    await expect(page.getByRole("cell", { name: "Salary Person A", exact: true })).toBeVisible();
    const updatedIncomeForm = page.locator("#income-form");
    await updatedIncomeForm.getByLabel("Bezeichnung").fill("Salary Person B");
    await updatedIncomeForm.getByLabel("Eigentümer").selectOption("person_b");
    await updatedIncomeForm.getByLabel("Betrag").fill("2.500,00");
    await updatedIncomeForm.getByLabel("Startmonat").fill("01.2026");
    await updatedIncomeForm.getByRole("button", { name: "Einnahme hinzufügen" }).click();
    await expect(page.getByRole("cell", { name: "Salary Person B", exact: true })).toBeVisible();
    await page.getByLabel("Eigentümer filtern").selectOption("person_b");
    await page.getByRole("button", { name: "Einnahmen filtern" }).click();

    await expect(page.getByRole("cell", { name: "Salary Person B", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Salary Person A", exact: true }),
    ).not.toBeVisible();
    await expect(page.getByText("Geplante Monatseinnahmen: 2.500,00")).toBeVisible();
  } finally {
    await server.close();
  }
});
