import { describe, expect, it } from "vitest";

import { createCategory } from "../../src/core/categories/category.js";

describe("Category", () => {
  it("creates a category with a trimmed name", () => {
    expect(
      createCategory({
        id: "category-groceries",
        name: " Groceries ",
      }),
    ).toEqual({
      id: "category-groceries",
      name: "Groceries",
    });
  });

  it("rejects an empty category name", () => {
    expect(() =>
      createCategory({
        id: "category-groceries",
        name: " ",
      }),
    ).toThrow("Category name is required");
  });
});
