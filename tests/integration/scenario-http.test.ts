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
  return {
    server,
    repositories,
    headers: { cookie: `ff_session=${session.value}`, "accept-language": "de" },
  };
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

      const list = await server.inject({ method: "GET", url: "/scenarios", headers });
      expect(list.body).toContain("Elternzeit");
      expect(list.body).toContain("Elternzeit HTMX");
    } finally {
      await server.close();
    }
  });

  it("updates and deletes adjustments with full-page and HTMX response parity", async () => {
    const { server, repositories, headers } = await authenticatedServer();
    try {
      await server.inject({
        method: "POST",
        url: "/scenarios",
        headers,
        payload: {
          name: "Maintenance",
          startMonth: "08.2026",
          endMonth: "01.2028",
          startingBuffer: "0,00",
          baseIncome: "100,00",
          baselineMode: "manual",
          manualBaseline: "50,00",
        },
      });
      const stored = (await repositories.scenarios.list())[0];
      if (stored === undefined) throw new Error("Scenario fixture must be persisted");
      await server.inject({
        method: "POST",
        url: `/scenarios/${stored.scenario.id}/adjustments`,
        headers,
        payload: {
          name: "Original",
          type: "income",
          direction: "increase",
          amount: "10,00",
          startMonth: "08.2026",
          endMonth: "08.2026",
        },
      });
      const adjustment = (await repositories.scenarios.get(stored.scenario.id))?.adjustments[0];
      if (adjustment === undefined) throw new Error("Adjustment fixture must be persisted");

      const updated = await server.inject({
        method: "POST",
        url: `/scenarios/${stored.scenario.id}/adjustments/${adjustment.id}`,
        headers: { ...headers, "hx-request": "true" },
        payload: {
          name: "Corrected",
          type: "expense",
          direction: "decrease",
          amount: "5,00",
          startMonth: "09.2026",
          endMonth: "10.2026",
        },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.body).toContain('id="scenario-panel"');
      await expect(repositories.scenarios.get(stored.scenario.id)).resolves.toMatchObject({
        adjustments: [
          {
            id: adjustment.id,
            name: "Corrected",
            type: "expense",
            deltaCents: -500,
            startMonth: "2026-09",
            endMonth: "2026-10",
          },
        ],
      });

      const removed = await server.inject({
        method: "POST",
        url: `/scenarios/${stored.scenario.id}/adjustments/${adjustment.id}/delete`,
        headers,
      });
      expect(removed.statusCode).toBe(302);
      await expect(repositories.scenarios.get(stored.scenario.id)).resolves.toMatchObject({
        adjustments: [],
      });
    } finally {
      await server.close();
    }
  });

  it("returns localized 400 errors without persistence mutation for malformed, orphaning, out-of-range, and negative-derived inputs", async () => {
    const { server, repositories, headers } = await authenticatedServer();
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
      expect(invalid.body).toContain("zwischen 18 und 24");

      const list = await server.inject({ method: "GET", url: "/scenarios", headers });
      expect(list.body).not.toContain("Invalid");

      await server.inject({
        method: "POST",
        url: "/scenarios",
        headers,
        payload: {
          name: "Derived validation",
          startMonth: "08.2026",
          endMonth: "01.2028",
          startingBuffer: "0,00",
          baseIncome: "10,00",
          baselineMode: "manual",
          manualBaseline: "10,00",
        },
      });
      const stored = (await repositories.scenarios.list())[0];
      if (stored === undefined) throw new Error("Scenario fixture must be persisted");
      const adjustment = await server.inject({
        method: "POST",
        url: `/scenarios/${stored.scenario.id}/adjustments`,
        headers,
        payload: {
          name: "Invalid income",
          type: "income",
          direction: "decrease",
          amount: "10,01",
          startMonth: "08.2026",
          endMonth: "08.2026",
        },
      });
      expect(adjustment.statusCode).toBe(400);
      await expect(repositories.scenarios.get(stored.scenario.id)).resolves.toMatchObject({
        adjustments: [],
      });

      const zeroAdjustment = await server.inject({
        method: "POST",
        url: `/scenarios/${stored.scenario.id}/adjustments`,
        headers,
        payload: {
          name: "Zero",
          type: "expense",
          direction: "increase",
          amount: "0,00",
          startMonth: "08.2026",
          endMonth: "08.2026",
        },
      });
      expect(zeroAdjustment.statusCode).toBe(400);
      await expect(repositories.scenarios.get(stored.scenario.id)).resolves.toMatchObject({
        adjustments: [],
      });
    } finally {
      await server.close();
    }
  });
});
