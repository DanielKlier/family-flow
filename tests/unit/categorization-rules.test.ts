import { describe, expect, it } from "vitest";

import { createCategorizationRule } from "../../src/core/categorization/categorization-rule.js";

describe("categorization rules", () => {
  it("creates a valid categorization rule", () => {
    expect(
      createCategorizationRule({
        id: "rule-groceries",
        name: " Groceries ",
        searchText: " supermarket ",
        categoryId: " category-groceries ",
        accountId: " checking ",
        priority: 10,
        enabled: true,
      }),
    ).toEqual({
      id: "rule-groceries",
      name: "Groceries",
      searchText: "supermarket",
      categoryId: "category-groceries",
      accountId: "checking",
      priority: 10,
      enabled: true,
    });
  });

  it("normalizes blank account restrictions to no restriction", () => {
    expect(
      createCategorizationRule({
        id: "rule-any-account",
        name: "Any account",
        searchText: "rent",
        categoryId: "category-rent",
        accountId: " ",
        priority: 1,
        enabled: true,
      }).accountId,
    ).toBeNull();
  });

  it("rejects invalid rule data", () => {
    expect(() =>
      createCategorizationRule({
        id: "rule-invalid",
        name: "Invalid",
        searchText: " ",
        categoryId: "category-groceries",
        accountId: null,
        priority: 1,
        enabled: true,
      }),
    ).toThrow("Categorization rule search text is required");
  });
});
