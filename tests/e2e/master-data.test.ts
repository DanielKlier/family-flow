import { expect, test } from "@playwright/test";

import { buildServer } from "../../src/app/server.js";

async function listen(server: ReturnType<typeof buildServer>) {
  await server.listen({ host: "127.0.0.1", port: 0 });

  const address = server.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the test server to listen on a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}

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
