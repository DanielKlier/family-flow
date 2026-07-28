import { describe, expect, it } from "vitest";

import { InMemoryAccountRepository } from "../../src/adapters/db/in-memory-account-repository.js";
import { InMemoryCategoryRepository } from "../../src/adapters/db/in-memory-category-repository.js";
import { seedMasterData } from "../../src/adapters/db/seeds/master-data.js";

describe("master data repositories", () => {
  it("stores and lists seeded accounts and categories", async () => {
    const accounts = new InMemoryAccountRepository();
    const categories = new InMemoryCategoryRepository();

    await seedMasterData({ accounts, categories });

    await expect(accounts.list()).resolves.toHaveLength(3);
    await expect(categories.list()).resolves.toHaveLength(12);
  });
});
