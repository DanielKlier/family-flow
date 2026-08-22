import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";
import { aTransaction } from "../support/transactions.js";

describe("transaction HTTP adapter", () => {
  it("INT-FF-TXN-002-01: saves localized manual cents but rejects missing references without mutation", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const server = buildServer({ repositories });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const headers = { cookie: `ff_session=${session.value}` };
      const payload = {
        accountId: "account-shared-checking",
        categoryId: "category-groceries",
        date: "15.07.2026",
        amount: "1.200,00",
        description: "Localized manual expense",
        status: "planned",
        fixedCost: "on",
      };

      const created = await server.inject({
        method: "POST",
        url: "/transactions",
        headers,
        payload,
      });
      expect(created.statusCode).toBe(302);
      expect(created.headers.location).toBe("/transactions");
      await expect(repositories.transactions.list({})).resolves.toEqual([
        expect.objectContaining({
          amountCents: -120000,
          status: "planned",
          fixedCost: true,
        }),
      ]);

      const htmxCreated = await server.inject({
        method: "POST",
        url: "/transactions",
        headers: { ...headers, "hx-request": "true" },
        payload: { ...payload, description: "HTMX manual expense" },
      });
      expect(htmxCreated.statusCode).toBe(200);
      expect(htmxCreated.body).toContain('id="transactions-list"');
      expect(htmxCreated.body).not.toContain('id="transactions-panel"');

      const beforeInvalid = await repositories.transactions.list({});
      for (const [field, value, localizedLabel, requestId] of [
        ["accountId", "account-does-not-exist", "Konto", "10000000-0000-4000-8000-000000000011"],
        [
          "categoryId",
          "category-does-not-exist",
          "Kategorie",
          "10000000-0000-4000-8000-000000000012",
        ],
      ]) {
        const invalid = await server.inject({
          method: "POST",
          url: "/transactions",
          headers: { ...headers, "x-request-id": requestId },
          payload: { ...payload, [field]: value },
        });
        expect(invalid.statusCode).toBe(400);
        expect(invalid.headers["x-request-id"]).toBe(requestId);
        expect(invalid.body).toContain(localizedLabel);
        expect(invalid.body).toContain(requestId);
        await expect(repositories.transactions.list({})).resolves.toEqual(beforeInvalid);
      }

      const htmxInvalid = await server.inject({
        method: "POST",
        url: "/transactions",
        headers: { ...headers, "hx-request": "true" },
        payload: { ...payload, accountId: "account-does-not-exist" },
      });
      expect(htmxInvalid.statusCode).toBe(400);
      expect(htmxInvalid.body).toContain('id="transactions-panel"');
    } finally {
      await server.close();
    }
  });

  it("INT-FF-TXN-001-05: preserves origin for description edits and marks actual category changes manual", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const imported = aTransaction({
      id: "transaction-origin-edit",
      accountId: "account-shared-checking",
      categoryId: "category-other",
      categoryOrigin: "fallback",
      date: "2026-07-15",
      description: "Original description",
      source: "csv",
      importHash: "v3:transaction-origin-edit",
    });
    await repositories.transactions.save(imported);
    const server = buildServer({ repositories });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const headers = { cookie: `ff_session=${session.value}` };
      const payload = {
        accountId: imported.accountId,
        categoryId: imported.categoryId,
        date: "15.07.2026",
        amount: "42,99",
        description: "Edited description",
        status: imported.status,
      };

      const descriptionEdit = await server.inject({
        method: "POST",
        url: `/transactions/${imported.id}`,
        headers,
        payload,
      });
      expect(descriptionEdit.statusCode).toBe(302);
      await expect(repositories.transactions.get(imported.id)).resolves.toMatchObject({
        description: "Edited description",
        categoryId: "category-other",
        categoryOrigin: "fallback",
      });

      const categoryEdit = await server.inject({
        method: "POST",
        url: `/transactions/${imported.id}`,
        headers,
        payload: { ...payload, categoryId: "category-groceries" },
      });
      expect(categoryEdit.statusCode).toBe(302);
      await expect(repositories.transactions.get(imported.id)).resolves.toMatchObject({
        categoryId: "category-groceries",
        categoryOrigin: "manual",
      });
    } finally {
      await server.close();
    }
  });

  it("INT-FF-TXN-005-02: mark and unmark preserve imported transaction identity fields", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const imported = aTransaction({
      id: "transaction-imported-transfer",
      accountId: "account-shared-checking",
      date: "2026-07-15",
      description: "Imported transfer maintenance",
      purpose: "Monthly settlement",
      source: "csv",
      importHash: "v3:imported-transfer-maintenance",
    });
    await repositories.transactions.save(imported);
    const server = buildServer({ repositories });

    try {
      const login = await server.inject({ method: "GET", url: "/auth/test-login" });
      const session = login.cookies.find(({ name }) => name === "ff_session");
      if (session === undefined) throw new Error("Test login must establish a session");
      const headers = { cookie: `ff_session=${session.value}` };

      const mark = await server.inject({
        method: "POST",
        url: `/transactions/${imported.id}/internal-transfer`,
        headers,
        payload: { internalTransfer: "true" },
      });
      expect(mark.statusCode).toBe(302);
      expect(mark.headers.location).toBe("/transactions");
      await expect(repositories.transactions.get(imported.id)).resolves.toMatchObject({
        source: "csv",
        purpose: "Monthly settlement",
        importHash: "v3:imported-transfer-maintenance",
        internalTransfer: true,
      });

      const unmark = await server.inject({
        method: "POST",
        url: `/transactions/${imported.id}/internal-transfer`,
        headers,
        payload: { internalTransfer: "false" },
      });
      expect(unmark.statusCode).toBe(302);
      await expect(repositories.transactions.get(imported.id)).resolves.toMatchObject({
        source: "csv",
        purpose: "Monthly settlement",
        importHash: "v3:imported-transfer-maintenance",
        internalTransfer: false,
      });

      await repositories.transactions.save({ ...imported, internalTransfer: true });
      for (const { payload, requestId } of [
        { payload: {}, requestId: "10000000-0000-4000-8000-000000000008" },
        {
          payload: { internalTransfer: "TRUE" },
          requestId: "10000000-0000-4000-8000-000000000009",
        },
        {
          payload: { internalTransfer: "invalid" },
          requestId: "10000000-0000-4000-8000-00000000000a",
        },
      ]) {
        const invalid = await server.inject({
          method: "POST",
          url: `/transactions/${imported.id}/internal-transfer`,
          headers: { ...headers, "x-request-id": requestId },
          payload,
        });
        expect(invalid.statusCode).toBe(400);
        expect(invalid.headers["x-request-id"]).toBe(requestId);
        expect(invalid.body).toContain(requestId);
        await expect(repositories.transactions.get(imported.id)).resolves.toMatchObject({
          internalTransfer: true,
        });
      }

      const missing = await server.inject({
        method: "POST",
        url: "/transactions/missing-transaction/internal-transfer",
        headers,
        payload: { internalTransfer: "true" },
      });
      expect(missing.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });
});
