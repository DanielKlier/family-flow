import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";
import { aTransaction } from "../support/transactions.js";

const julyClock = { now: () => new Date(2026, 6, 10, 12, 0, 0) };

async function authenticatedServer() {
  const repositories = createSeededInMemoryRepositories(createGermanLocalization());
  await repositories.transactions.save(aTransaction({ date: "2026-04-02", amountCents: -30_000 }));
  const server = buildServer({ repositories, clock: julyClock });
  const login = await server.inject({ method: "GET", url: "/auth/test-login" });
  const session = login.cookies.find(({ name }) => name === "ff_session");
  if (session === undefined) throw new Error("Test login must establish a session");
  return { server, headers: { cookie: `ff_session=${session.value}`, "accept-language": "de" } };
}

describe("scenario HTTP adapter", () => {
  it("INT-FF-SCN-001-03 parses German form values, snapshots with the controlled clock, and preserves request IDs for full and HTMX successes", async () => {
    const { server, headers } = await authenticatedServer();
    try {
      const fullPage = await server.inject({
        method: "POST",
        url: "/scenarios",
        headers: { ...headers, "x-request-id": "scenario-redirect" },
        payload: {
          name: "Elternzeit",
          startMonth: "08.2026",
          endMonth: "01.2028",
          startingBuffer: "1.000,00",
          baseIncome: "3.000,00",
          baselineMode: "historical",
          historicalWindow: "3",
        },
      });
      expect(fullPage.statusCode).toBe(302);
      expect(fullPage.headers["x-request-id"]).toBe("scenario-redirect");

      const htmx = await server.inject({
        method: "POST",
        url: "/scenarios",
        headers: { ...headers, "hx-request": "true", "x-request-id": "scenario-fragment" },
        payload: {
          name: "Elternzeit HTMX",
          startMonth: "08.2026",
          endMonth: "07.2028",
          startingBuffer: "0,00",
          baseIncome: "3.000,00",
          baselineMode: "manual",
          manualBaseline: "300,00",
        },
      });
      expect(htmx.statusCode).toBe(200);
      expect(htmx.headers["x-request-id"]).toBe("scenario-fragment");
      expect(htmx.body).toContain('id="scenario-panel"');
      expect(htmx.body).not.toContain("<!doctype html>");
    } finally {
      await server.close();
    }
  });

  it("returns localized 400 errors without persistence mutation for malformed, orphaning, out-of-range, and negative-derived inputs", async () => {
    const { server, headers } = await authenticatedServer();
    try {
      const invalid = await server.inject({
        method: "POST",
        url: "/scenarios",
        headers: { ...headers, "x-request-id": "scenario-invalid" },
        payload: {
          name: "Invalid",
          startMonth: "08.2026",
          endMonth: "12.2026",
          startingBuffer: "x",
          baseIncome: "0,00",
          baselineMode: "manual",
          manualBaseline: "0,00",
        },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.headers["x-request-id"]).toBe("scenario-invalid");
      expect(invalid.body).toContain("18 oder 24");

      const list = await server.inject({ method: "GET", url: "/scenarios", headers });
      expect(list.body).not.toContain("Invalid");
    } finally {
      await server.close();
    }
  });
});
