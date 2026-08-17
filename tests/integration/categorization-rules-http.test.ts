import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";
import { aTransaction } from "../support/transactions.js";

describe("categorization rules HTTP adapter", () => {
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
      expect(apply.statusCode).toBe(302);
      await expect(repositories.transactions.get(imported.id)).resolves.toEqual({
        ...imported,
        internalTransfer: true,
      });
    } finally {
      await server.close();
    }
  });
});
