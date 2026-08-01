import { describe, expect, it } from "vitest";

import {
  createCategorizationRule,
  findCategorizationMatch,
} from "../../src/core/categorization/categorization-rule.js";

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

  it("matches enabled rules case-insensitively against description and payee", () => {
    const match = findCategorizationMatch(
      [
        createCategorizationRule({
          id: "rule-disabled",
          name: "Disabled",
          searchText: "market",
          categoryId: "category-disabled",
          priority: 1,
          enabled: false,
        }),
        createCategorizationRule({
          id: "rule-groceries",
          name: "Groceries",
          searchText: "supermarket",
          categoryId: "category-groceries",
          priority: 10,
          enabled: true,
        }),
      ],
      {
        accountId: "checking",
        description: "Weekly SUPERMARKET purchase",
        payee: null,
      },
    );

    expect(match?.categoryId).toBe("category-groceries");
  });

  it("chooses the highest priority matching rule", () => {
    const match = findCategorizationMatch(
      [
        createCategorizationRule({
          id: "rule-low",
          name: "Low",
          searchText: "market",
          categoryId: "category-low",
          priority: 20,
          enabled: true,
        }),
        createCategorizationRule({
          id: "rule-high",
          name: "High",
          searchText: "farmers market",
          categoryId: "category-high",
          priority: 5,
          enabled: true,
        }),
      ],
      {
        accountId: "checking",
        description: "Farmers Market",
        payee: null,
      },
    );

    expect(match?.id).toBe("rule-high");
  });
});
