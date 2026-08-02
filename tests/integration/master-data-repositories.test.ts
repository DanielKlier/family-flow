import { describe, expect, it } from "vitest";

import { InMemoryAccountRepository } from "../../src/adapters/db/in-memory-account-repository.js";
import { InMemoryCategoryRepository } from "../../src/adapters/db/in-memory-category-repository.js";
import { InMemoryOwnerContextRepository } from "../../src/adapters/db/in-memory-owner-context-repository.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";

describe("master data repositories", () => {
  it("stores and lists seeded accounts and categories", async () => {
    const accounts = new InMemoryAccountRepository();
    const categories = new InMemoryCategoryRepository();
    const ownerContexts = new InMemoryOwnerContextRepository([]);

    await seedMasterData({ accounts, categories, ownerContexts });

    await expect(ownerContexts.list()).resolves.toHaveLength(3);
    await expect(accounts.list()).resolves.toHaveLength(3);
    await expect(categories.list()).resolves.toHaveLength(12);
  });

  it("updates and filters account active status", async () => {
    const accounts = new InMemoryAccountRepository();

    await accounts.save({
      id: "account-test",
      name: "Test account",
      ownerContext: "shared",
      active: true,
    });
    await accounts.save({
      id: "account-test",
      name: "Renamed account",
      ownerContext: "person_a",
      active: false,
    });

    await expect(accounts.list()).resolves.toEqual([
      {
        id: "account-test",
        name: "Renamed account",
        ownerContext: "person_a",
        active: false,
      },
    ]);
    await expect(accounts.listActive()).resolves.toEqual([]);
  });

  it("updates and filters category active status", async () => {
    const categories = new InMemoryCategoryRepository();

    await categories.save({ id: "category-test", name: "Test category", active: true });
    await categories.save({ id: "category-test", name: "Renamed category", active: false });

    await expect(categories.list()).resolves.toEqual([
      { id: "category-test", name: "Renamed category", active: false },
    ]);
    await expect(categories.listActive()).resolves.toEqual([]);
  });
});
