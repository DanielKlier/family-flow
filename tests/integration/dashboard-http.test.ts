import { describe, expect, it } from "vitest";
import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";

describe("dashboard HTTP adapter", () => {
  it("defaults to the clock's local calendar date at a month boundary", async () => {
    const server = buildServer({ clock: { now: () => new Date(2026, 2, 1, 0, 30, 0) } });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const response = await server.inject({
        method: "GET",
        url: "/",
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

  it("INT-FF-DASH-003-01 rejects a localized future month with the supplied request ID", async () => {
    const server = buildServer();

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const response = await server.inject({
        method: "GET",
        url: "/?month=01.2099",
        headers: {
          cookie: `ff_session=${session.value}`,
          "accept-language": "de",
          "hx-request": "true",
          "x-request-id": "dashboard-future-month",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["x-request-id"]).toBe("dashboard-future-month");
      expect(response.body).toContain("dashboard-future-month");
      expect(response.body).toContain("Zukünftige Monate");
    } finally {
      await server.close();
    }
  });

  it("returns recognized dashboard query validation as 400", async () => {
    const server = buildServer();

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const response = await server.inject({
        method: "GET",
        url: "/?ownerContext=unknown",
        headers: { cookie: `ff_session=${session.value}` },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await server.close();
    }
  });

  it("preserves global 500 handling for dashboard repository failures", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    repositories.transactions.list = async () => {
      throw new Error("database unavailable");
    };
    const server = buildServer({ repositories });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const response = await server.inject({
        method: "GET",
        url: "/",
        headers: { cookie: `ff_session=${session.value}` },
      });

      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain("database unavailable");
    } finally {
      await server.close();
    }
  });
});
