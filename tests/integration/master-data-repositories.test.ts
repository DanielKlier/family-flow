import { describe, expect, it } from "vitest";

import { createGermanLocalization } from "../../src/adapters/localization/german.js";

import { InMemoryAccountRepository } from "../../src/adapters/db/in-memory-account-repository.js";
import { InMemoryCategoryRepository } from "../../src/adapters/db/in-memory-category-repository.js";
import { InMemoryOwnerContextRepository } from "../../src/adapters/db/in-memory-owner-context-repository.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";

describe("master data repositories", () => {
  it("stores and lists seeded accounts and categories", async () => {
    const accounts = new InMemoryAccountRepository();
    const categories = new InMemoryCategoryRepository();
    const ownerContexts = new InMemoryOwnerContextRepository([]);

    await seedMasterData({ accounts, categories, ownerContexts }, createGermanLocalization());

    await expect(ownerContexts.list()).resolves.toEqual([
      { ownerContext: "person_a", label: "Person A" },
      { ownerContext: "person_b", label: "Person B" },
      { ownerContext: "shared", label: "Gemeinsam" },
    ]);
    await expect(accounts.list()).resolves.toHaveLength(3);
    await expect(categories.list()).resolves.toHaveLength(12);
  });

  it("does not rename existing records when seeds run again", async () => {
    const localization = createGermanLocalization();
    const accounts = new InMemoryAccountRepository();
    const categories = new InMemoryCategoryRepository();
    const ownerContexts = new InMemoryOwnerContextRepository();
    const repositories = { accounts, categories, ownerContexts };
    await seedMasterData(repositories, localization);

    const account = await accounts.get("account-person-a-checking");
    const category = await categories.get("category-other");
    if (account === null || category === null) throw new Error("Master data seed must exist");
    await accounts.save({ ...account, name: "Custom account" });
    await categories.save({ ...category, name: "Custom category" });
    await ownerContexts.save({ ownerContext: "shared", label: "Custom owner" });

    await seedMasterData(repositories, localization);

    await expect(accounts.get(account.id)).resolves.toMatchObject({ name: "Custom account" });
    await expect(categories.get(category.id)).resolves.toMatchObject({ name: "Custom category" });
    await expect(ownerContexts.get("shared")).resolves.toMatchObject({ label: "Custom owner" });
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
