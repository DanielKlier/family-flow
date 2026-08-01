import { describe, expect, it } from "vitest";

import { createCategory, updateCategory } from "../../src/core/categories/category.js";

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
      active: true,
    });
  });

  it("updates category editable fields", () => {
    expect(
      updateCategory(
        createCategory({
          id: "category-groceries",
          name: "Groceries",
        }),
        {
          name: "Food",
          active: false,
        },
      ),
    ).toEqual({
      id: "category-groceries",
      name: "Food",
      active: false,
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
