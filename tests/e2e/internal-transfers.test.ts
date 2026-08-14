import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("E2E-FF-UI-001-02: transfer actions progressively enhance the transactions list", async ({
  page,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);
    await page.getByLabel("Description").fill("Progressive transfer");
    await page.getByLabel("Amount").fill("10.00");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByRole("button", { name: "Add transaction" }).click();

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
