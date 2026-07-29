import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";
import { listen } from "../support/server.js";

test("accounts list is visible after seeding", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await request.get(`${baseUrl}/auth/test-login`);
    const response = await request.get(`${baseUrl}/admin/master-data`);
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain("Accounts");
    expect(body).toContain("Person A checking");
    expect(body).toContain("Person B checking");
    expect(body).toContain("Shared checking");
  } finally {
    await server.close();
  }
});

test("categories list is visible after seeding", async ({ request }) => {
  const server = buildServer();

  try {
    const baseUrl = await listen(server);
    await request.get(`${baseUrl}/auth/test-login`);
    const response = await request.get(`${baseUrl}/admin/master-data`);
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain("Categories");
    expect(body).toContain("Wohnen/Miete");
    expect(body).toContain("Lebensmittel");
    expect(body).toContain("Sonstiges");
  } finally {
    await server.close();
  }
});
