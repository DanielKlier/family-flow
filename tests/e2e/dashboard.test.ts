import { expect, type Page, test } from "@playwright/test";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";
import { createIncomePlan } from "../../src/core/income/income-plan.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";
import { aTransaction } from "../support/transactions.js";

const julyClock = { now: () => new Date(2026, 6, 10, 12, 0, 0) };

async function dashboardFixture() {
  const repositories = createSeededInMemoryRepositories(createGermanLocalization());
  await repositories.income.savePlan(
    createIncomePlan({
      id: "dashboard-salary",
      ownerContext: "person_a",
      name: "Salary",
      amountCents: 300_000,
      startMonth: "2026-01",
      endMonth: null,
      active: true,
    }),
  );
  for (const transaction of [
    aTransaction({
      id: "dashboard-rent",
      accountId: "account-shared-checking",
      categoryId: "category-housing-rent",
      date: "2026-07-01",
      amountCents: -100_000,
      description: "Rent",
      fixedCost: true,
    }),
    aTransaction({
      id: "dashboard-groceries",
      date: "2026-07-02",
      amountCents: -30_000,
      description: "Groceries",
    }),
    aTransaction({
      id: "dashboard-planned-insurance",
      accountId: "account-shared-checking",
      categoryId: "category-insurance",
      date: "2026-07-20",
      amountCents: -50_000,
      description: "Insurance",
      fixedCost: true,
      status: "planned",
    }),
    aTransaction({
      id: "dashboard-transfer",
      date: "2026-07-03",
      amountCents: -70_000,
      description: "Transfer",
      internalTransfer: true,
    }),
    aTransaction({ id: "history-april", date: "2026-04-02", amountCents: -30_000 }),
    aTransaction({ id: "history-may", date: "2026-05-02", amountCents: -60_000 }),
    aTransaction({ id: "history-june", date: "2026-06-02", amountCents: -90_000 }),
  ]) {
    await repositories.transactions.save(transaction);
  }
  return repositories;
}

function section(page: Page, heading: string) {
  return page
    .locator("section.panel")
    .filter({ has: page.getByRole("heading", { name: heading }) });
}

test("E2E-FF-DASH-001-01 E2E-FF-DASH-002-01 E2E-FF-DASH-004-01 E2E-FF-FOR-001-01 shows exact reconciled totals, breakdowns, averages, and current forecast", async ({
  page,
}) => {
  const repositories = await dashboardFixture();
  const server = buildServer({ repositories, clock: julyClock });

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/`);

    await expect(page.locator("section.metrics dd")).toHaveText([
      "3.000,00",
      "1.300,00",
      "1.700,00",
    ]);
    await expect(section(page, "Ausgaben nach Kategorie").locator("li")).toHaveText([
      "Lebensmittel: 300,00",
      "Wohnen/Miete: 1.000,00",
    ]);
    await expect(section(page, "Ausgaben nach Konto").locator("li")).toHaveText([
      "Gemeinsames Girokonto (Gemeinsam): 1.000,00",
      "Girokonto Person A (Person A): 300,00",
    ]);
    await expect(
      section(page, "Historische Ausgabendurchschnitte (Monate)").locator("li"),
    ).toHaveText(["3: 600,00", "6: 300,00", "12: 150,00"]);
    await expect(section(page, "Monatsprognose").locator("dd")).toHaveText([
      "1.000,00",
      "500,00",
      "930,00",
      "2.430,00",
    ]);
  } finally {
    await server.close();
  }
});

test("E2E-FF-DASH-003-01 E2E-FF-MDM-001-02 applies owner, account, and category filters together", async ({
  page,
}) => {
  const repositories = await dashboardFixture();
  const server = buildServer({ repositories, clock: julyClock });

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(
      `${baseUrl}/?month=07.2026&ownerContext=person_a&accountId=account-person-a-checking&categoryId=category-groceries`,
    );

    await expect(page.getByLabel("Eigentümer")).toHaveValue("person_a");
    await expect(page.getByLabel("Konto")).toHaveValue("account-person-a-checking");
    await expect(page.getByLabel("Kategorie")).toHaveValue("category-groceries");
    await expect(page.locator("section.metrics dd")).toHaveText(["3.000,00", "300,00", "2.700,00"]);
    await expect(section(page, "Ausgaben nach Kategorie").locator("li")).toHaveText([
      "Lebensmittel: 300,00",
    ]);
    await expect(section(page, "Ausgaben nach Konto").locator("li")).toHaveText([
      "Girokonto Person A (Person A): 300,00",
    ]);
  } finally {
    await server.close();
  }
});

test("E2E-FF-LOC-001-02 distinguishes localized past and future dashboard months", async ({
  page,
}) => {
  const repositories = await dashboardFixture();
  const server = buildServer({ repositories, clock: julyClock });

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/?month=06.2026`);

    await expect(page.getByLabel("Monat")).toHaveValue("06.2026");
    await expect(section(page, "Monatsprognose")).toContainText(
      "Für vergangene Monate wird keine Prognose angezeigt.",
    );

    const response = await page.goto(`${baseUrl}/?month=08.2026`);
    expect(response?.status()).toBe(400);
    await expect(page.getByText("Zukünftige Monate können nicht ausgewählt werden.")).toBeVisible();
  } finally {
    await server.close();
  }
});

test("E2E-FF-FOR-004-01 E2E-FF-TXN-006-02 moves a planned fixed expense to booked without double counting", async ({
  page,
}) => {
  const repositories = await dashboardFixture();
  const server = buildServer({ repositories, clock: julyClock });

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/`);
    await expect(section(page, "Monatsprognose").locator("dd")).toHaveText([
      "1.000,00",
      "500,00",
      "930,00",
      "2.430,00",
    ]);

    const planned = await repositories.transactions.get("dashboard-planned-insurance");
    if (planned === null) throw new Error("Planned transition fixture must exist");
    await repositories.transactions.save({ ...planned, status: "booked" });
    await page.reload();

    await expect(page.locator("section.metrics dd").nth(1)).toHaveText("1.800,00");
    await expect(section(page, "Monatsprognose").locator("dd")).toHaveText([
      "1.500,00",
      "0,00",
      "930,00",
      "2.430,00",
    ]);
  } finally {
    await server.close();
  }
});
