import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserPage } from "../support/auth.js";
import { listen } from "../support/server.js";

test("transaction month filter shows the expected month format", async ({ page }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserPage(page, baseUrl);
    await page.goto(`${baseUrl}/transactions`);

    await expect(page.locator("#transaction-filters").getByLabel("Month")).toHaveAttribute(
      "placeholder",
      "YYYY-MM",
    );
  } finally {
    await server.close();
  }
});
