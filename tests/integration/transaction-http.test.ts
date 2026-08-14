import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { buildServer } from "../../src/app/server.js";
import { aTransaction } from "../support/transactions.js";

describe("transaction transfer HTTP adapter", () => {
  it("INT-FF-TXN-005-02: mark and unmark preserve imported transaction identity fields", async () => {
    const repositories = createSeededInMemoryRepositories();
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
      for (const payload of [{}, { internalTransfer: "TRUE" }, { internalTransfer: "invalid" }]) {
        const requestId = `invalid-transfer-${String(payload.internalTransfer ?? "missing")}`;
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
