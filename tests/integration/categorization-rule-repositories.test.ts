import { describe, expect, it } from "vitest";

import { InMemoryCategorizationRuleRepository } from "../../src/adapters/db/in-memory-categorization-rule-repository.js";
import { createCategorizationRule } from "../../src/core/categorization/categorization-rule.js";

describe("categorization rule repositories", () => {
  it("stores, lists, gets, and deletes categorization rules", async () => {
    const repository = new InMemoryCategorizationRuleRepository();
    const groceries = createCategorizationRule({
      id: "rule-groceries",
      name: "Groceries",
      searchText: "supermarket",
      categoryId: "category-groceries",
      priority: 10,
      enabled: true,
    });
    const rent = createCategorizationRule({
      id: "rule-rent",
      name: "Rent",
      searchText: "landlord",
      categoryId: "category-housing-rent",
      priority: 1,
      enabled: true,
    });

    await repository.save(groceries);
    await repository.save(rent);

    await expect(repository.list()).resolves.toEqual([rent, groceries]);
    await expect(repository.get("rule-groceries")).resolves.toEqual(groceries);

    await repository.delete("rule-rent");

    await expect(repository.list()).resolves.toEqual([groceries]);
  });
});
