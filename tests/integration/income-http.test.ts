import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";

describe("income HTTP adapter", () => {
  it("defaults to the clock's local calendar month at a month boundary", async () => {
    const server = buildServer({ clock: { now: () => new Date(2026, 2, 1, 0, 30, 0) } });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const response = await server.inject({
        method: "GET",
        url: "/income",
        headers: { cookie: `ff_session=${session.value}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain(
        'name="month" inputmode="numeric" placeholder="MM.JJJJ" value="03.2026"',
      );
    } finally {
      await server.close();
    }
  });

  it("INT-FF-INC-001-02 accepts a localized zero override and renders its exact monthly total", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const server = buildServer({ repositories });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const headers = { cookie: `ff_session=${session.value}`, "hx-request": "true" };

      const create = await server.inject({
        method: "POST",
        url: "/income",
        headers,
        payload: {
          name: "Zero override salary",
          ownerContext: "person_a",
          amount: "3.500,00",
          startMonth: "01.2026",
          active: "on",
        },
      });
      expect(create.statusCode).toBe(200);
      const [plan] = await repositories.income.listPlans({ ownerContext: "person_a" });
      if (plan === undefined) throw new Error("Income plan must have been saved");

      const override = await server.inject({
        method: "POST",
        url: "/income/overrides",
        headers,
        payload: { incomePlanId: plan.id, month: "08.2026", amount: "0,00", note: "Unpaid leave" },
      });
      expect(override.statusCode).toBe(200);

      const monthly = await server.inject({
        method: "GET",
        url: "/income?month=08.2026&ownerContext=person_a",
        headers,
      });
      expect(monthly.statusCode).toBe(200);
      expect(monthly.body).toContain("Geplante Monatseinnahmen: 0,00");
    } finally {
      await server.close();
    }
  });

  it("INT-FF-INC-005-02 requires an activation route that preserves the saved plan", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const server = buildServer({ repositories });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const headers = { cookie: `ff_session=${session.value}`, "hx-request": "true" };
      await server.inject({
        method: "POST",
        url: "/income",
        headers,
        payload: {
          name: "Reactivatable salary",
          ownerContext: "person_a",
          amount: "3.500,00",
          startMonth: "01.2026",
          active: "on",
        },
      });
      const [plan] = await repositories.income.listPlans({ ownerContext: "person_a" });
      if (plan === undefined) throw new Error("Income plan must have been saved");

      const deactivate = await server.inject({
        method: "POST",
        url: `/income/${plan.id}/deactivate`,
        headers,
      });
      expect(deactivate.statusCode).toBe(200);
      await expect(repositories.income.getPlan(plan.id)).resolves.toMatchObject({
        active: false,
        name: "Reactivatable salary",
        amountCents: 350000,
        startMonth: "2026-01",
      });
    } finally {
      await server.close();
    }
  });
});
