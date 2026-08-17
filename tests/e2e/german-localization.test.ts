import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { loginAsTestUserRequest } from "../support/auth.js";
import { listen } from "../support/server.js";

test("E2E-FF-LOC-001-01 existing authenticated surfaces present German navigation, labels, help, and validation", async ({
  request,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);

    for (const [path, text] of [
      ["/admin/master-data", "Stammdaten"],
      ["/transactions", "Transaktionen"],
      ["/imports/csv", "CSV-Import"],
      ["/categorization-rules", "Kategorisierungsregeln"],
      ["/income", "Einnahmen"],
    ]) {
      const response = await request.get(`${baseUrl}${path}`);
      expect(response.status(), path).toBe(200);
      expect(await response.text(), path).toContain(text);
    }

    const invalidTransaction = await request.post(`${baseUrl}/transactions`, {
      form: {
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "31.12.2026",
        description: "",
        amount: "1.234,56",
        status: "booked",
      },
    });
    expect(invalidTransaction.status()).toBe(400);
    expect(await invalidTransaction.text()).toContain("Beschreibung ist erforderlich");
  } finally {
    await server.close();
  }
});

test("E2E-FF-LOC-002-01 a German transaction form stores canonical values and renders them in German", async ({
  request,
}) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await loginAsTestUserRequest(request, baseUrl);

    const create = await request.post(`${baseUrl}/transactions`, {
      form: {
        accountId: "account-person-a-checking",
        categoryId: "category-groceries",
        date: "31.12.2026",
        description: "German form transaction",
        amount: "1.234,56",
        status: "booked",
      },
    });
    expect(create.status()).toBe(200);

    const body = await (await request.get(`${baseUrl}/transactions`)).text();
    expect(body).toContain("German form transaction");
    expect(body).toContain("31.12.2026");
    expect(body).toContain("1.234,56");
  } finally {
    await server.close();
  }
});
