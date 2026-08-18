import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";

describe("category normalization HTTP adapter", () => {
  it("INT-FF-CAT-004-02: rejects create and edit collisions with a friendly response", async () => {
    const localization = createGermanLocalization();
    const repositories = createSeededInMemoryRepositories(localization);
    const server = buildServer({ repositories });
    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const headers = { cookie: `ff_session=${session.value}` };

      const create = await server.inject({
        method: "POST",
        url: "/admin/master-data/categories",
        headers,
        payload: { name: " Ｌｅｂｅｎｓｍｉｔｔｅｌ " },
      });
      expect(create.statusCode).toBe(400);
      expect(create.body).toContain("Die Stammdaten konnten nicht gespeichert werden.");

      const edit = await server.inject({
        method: "POST",
        url: "/admin/master-data/categories/category-other",
        headers,
        payload: { name: "  LEBENSMITTEL  ", active: "on" },
      });
      expect(edit.statusCode).toBe(400);
      expect(edit.body).toContain("Die Stammdaten konnten nicht gespeichert werden.");
    } finally {
      await server.close();
    }
  });
});
