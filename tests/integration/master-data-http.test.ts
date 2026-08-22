import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";

async function authenticatedHeaders(server: ReturnType<typeof buildServer>) {
  const login = await server.inject({ method: "GET", url: "/auth/test-login" });
  const session = login.cookies.find(({ name }) => name === "ff_session");
  if (session === undefined) throw new Error("Test login must establish a session");
  return { cookie: `ff_session=${session.value}` };
}

describe("master-data HTTP adapter", () => {
  it("INT-FF-MDM-001-01 maps an owner-label update without changing stable account ownership", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const server = buildServer({ repositories });

    try {
      const headers = await authenticatedHeaders(server);
      const accountsBefore = await repositories.accounts.list();
      const ownerKeysBefore = (await repositories.ownerContexts.list()).map(
        ({ ownerContext }) => ownerContext,
      );
      const response = await server.inject({
        method: "POST",
        url: "/admin/master-data/owner-contexts/person_a",
        headers,
        payload: { label: "Alex" },
      });

      expect(response.statusCode).toBe(302);
      await expect(repositories.ownerContexts.get("person_a")).resolves.toEqual({
        ownerContext: "person_a",
        label: "Alex",
      });
      await expect(repositories.ownerContexts.get("person_b")).resolves.toEqual({
        ownerContext: "person_b",
        label: "Person B",
      });
      await expect(repositories.ownerContexts.list()).resolves.toMatchObject(
        ownerKeysBefore.map((ownerContext) => ({ ownerContext })),
      );
      await expect(repositories.accounts.list()).resolves.toEqual(accountsBefore);
    } finally {
      await server.close();
    }
  });

  it("INT-FF-MDM-003-01 maps account create, edit, deactivate, and reactivate", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const server = buildServer({ repositories });

    try {
      const headers = await authenticatedHeaders(server);
      const create = await server.inject({
        method: "POST",
        url: "/admin/master-data/accounts",
        headers,
        payload: { name: "HTTP account", ownerContext: "shared" },
      });
      expect(create.statusCode).toBe(302);
      await expect(repositories.accounts.list()).resolves.toContainEqual(
        expect.objectContaining({
          name: "HTTP account",
          ownerContext: "shared",
          active: true,
        }),
      );

      const id = "account-person-a-checking";
      const deactivate = await server.inject({
        method: "POST",
        url: `/admin/master-data/accounts/${id}/deactivate`,
        headers,
      });
      expect(deactivate.statusCode).toBe(302);
      await expect(repositories.accounts.get(id)).resolves.toMatchObject({ active: false });
      await expect(repositories.accounts.listActive()).resolves.not.toContainEqual(
        expect.objectContaining({ id }),
      );

      const reactivate = await server.inject({
        method: "POST",
        url: `/admin/master-data/accounts/${id}`,
        headers,
        payload: { name: "Reactivated account", ownerContext: "person_b", active: "on" },
      });
      expect(reactivate.statusCode).toBe(302);
      await expect(repositories.accounts.get(id)).resolves.toEqual({
        id,
        name: "Reactivated account",
        ownerContext: "person_b",
        active: true,
      });
      await expect(repositories.accounts.listActive()).resolves.toContainEqual(
        expect.objectContaining({ id }),
      );
    } finally {
      await server.close();
    }
  });

  it("INT-FF-MDM-004-01 maps category create, edit, deactivate, and reactivate", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const server = buildServer({ repositories });

    try {
      const headers = await authenticatedHeaders(server);
      const create = await server.inject({
        method: "POST",
        url: "/admin/master-data/categories",
        headers,
        payload: { name: "HTTP category" },
      });
      expect(create.statusCode).toBe(302);
      await expect(repositories.categories.list()).resolves.toContainEqual(
        expect.objectContaining({ name: "HTTP category", active: true }),
      );

      const id = "category-groceries";
      const deactivate = await server.inject({
        method: "POST",
        url: `/admin/master-data/categories/${id}/deactivate`,
        headers,
      });
      expect(deactivate.statusCode).toBe(302);
      await expect(repositories.categories.get(id)).resolves.toMatchObject({ active: false });
      await expect(repositories.categories.listActive()).resolves.not.toContainEqual(
        expect.objectContaining({ id }),
      );

      const reactivate = await server.inject({
        method: "POST",
        url: `/admin/master-data/categories/${id}`,
        headers,
        payload: { name: "Reactivated category", active: "on" },
      });
      expect(reactivate.statusCode).toBe(302);
      await expect(repositories.categories.get(id)).resolves.toEqual({
        id,
        name: "Reactivated category",
        active: true,
      });
      await expect(repositories.categories.listActive()).resolves.toContainEqual(
        expect.objectContaining({ id }),
      );
    } finally {
      await server.close();
    }
  });
});
