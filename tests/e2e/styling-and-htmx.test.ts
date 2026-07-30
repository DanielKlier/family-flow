import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage, loginAsTestUserRequest } from "../support/auth.js";
import { listen } from "../support/server.js";

test("transaction page includes the stylesheet and no inline style attributes", async ({
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
    expect(body).not.toMatch(/\sstyle=/i);
  } finally {
    await server.close();
  }
});

test("transaction creation updates the list with HTMX without a full page reload", async ({
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

    await page.getByLabel("Description").fill("HTMX groceries");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByRole("button", { name: "Add transaction" }).click();

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
    await page.getByLabel("Description").fill("HTMX personal groceries");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByLabel("Transaction account").selectOption("account-person-a-checking");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page.getByLabel("Description").fill("HTMX shared rent");
    await page.getByLabel("Amount").fill("1200.00");
    await page.getByLabel("Date").fill("2026-07-01");
    await page.getByLabel("Transaction account").selectOption("account-shared-checking");
    await page.getByRole("button", { name: "Add transaction" }).click();
    await page.evaluate(() => {
      (window as unknown as { familyFlowFilterMarker: string }).familyFlowFilterMarker = "kept";
    });

    await page.getByLabel("Owner context").selectOption("shared");
    await page.getByRole("button", { name: "Apply filters" }).click();

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

test("transaction form remains usable without JavaScript", async ({ browser }) => {
  const server = buildServer();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("No JS groceries");
    await page.getByLabel("Amount").fill("42.99");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await expect(page).toHaveURL(`${baseUrl}/transactions`);
    await expect(page.getByRole("cell", { name: "No JS groceries", exact: true })).toBeVisible();
  } finally {
    await context.close();
    await server.close();
  }
});
