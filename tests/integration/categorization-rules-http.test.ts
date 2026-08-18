import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";
import { aTransaction } from "../support/transactions.js";

describe("categorization rules HTTP adapter", () => {
  it("INT-FF-CAT-005-01: creates, edits, deletes, and renders friendly validation", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const server = buildServer({ repositories });
    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const headers = { cookie: `ff_session=${session.value}` };
      const invalid = await server.inject({
        method: "POST",
        url: "/categorization-rules",
        headers,
        payload: { name: "", searchText: "", categoryId: "", priority: "-1" },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.body).toContain("konnte nicht gespeichert werden");

      await server.inject({
        method: "POST",
        url: "/categorization-rules",
        headers,
        payload: {
          name: "HTTP rule",
          searchText: "market",
          categoryId: "category-groceries",
          priority: "1",
        },
      });
      const rule = (await repositories.categorizationRules.list()).find(
        ({ name }) => name === "HTTP rule",
      );
      if (rule === undefined) throw new Error("Created rule must exist");
      const update = await server.inject({
        method: "POST",
        url: `/categorization-rules/${rule.id}`,
        headers,
        payload: {
          name: "Updated HTTP rule",
          searchText: "shop",
          categoryId: "category-other",
          priority: "2",
        },
      });
      expect(update.statusCode).toBe(302);
      await expect(repositories.categorizationRules.get(rule.id)).resolves.toMatchObject({
        name: "Updated HTTP rule",
      });

      const deletion = await server.inject({
        method: "POST",
        url: `/categorization-rules/${rule.id}/delete`,
        headers,
      });
      expect(deletion.statusCode).toBe(302);
      await expect(repositories.categorizationRules.get(rule.id)).resolves.toBeNull();
    } finally {
      await server.close();
    }
  });

  it("INT-FF-CAT-002-04: persists a transfer-only reapplication without changing imported transaction identity", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const imported = aTransaction({
      id: "transaction-imported-rule-transfer",
      accountId: "account-shared-checking",
      date: "2026-07-15",
      description: "Imported settlement",
      purpose: "July settlement",
      source: "csv",
      importHash: "v3:imported-rule-transfer",
      categoryOrigin: "legacy_preserved",
      internalTransfer: false,
    });
    await repositories.transactions.save(imported);
    const server = buildServer({ repositories });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const headers = { cookie: `ff_session=${session.value}` };

      const create = await server.inject({
        method: "POST",
        url: "/categorization-rules",
        headers,
        payload: {
          name: "Mark imported settlements",
          searchText: "settlement",
          categoryId: "category-groceries",
          fixedCost: "unchanged",
          internalTransfer: "mark",
          priority: "1",
        },
      });
      expect(create.statusCode).toBe(302);

      const apply = await server.inject({
        method: "POST",
        url: "/categorization-rules/apply",
        headers,
      });
      expect(apply.statusCode).toBe(200);
      expect(apply.body).toContain("1 geändert");
      expect(apply.body).toContain("0 unverändert");
      await expect(repositories.transactions.get(imported.id)).resolves.toEqual({
        ...imported,
        internalTransfer: true,
      });
    } finally {
      await server.close();
    }
  });
});
