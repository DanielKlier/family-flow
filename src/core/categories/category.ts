import { normalizeCanonicalText } from "../shared/normalize-canonical-text.js";

export type Category = {
  id: string;
  name: string;
  active: boolean;
};

export type CategoryInput = {
  id: string;
  name: string;
  active?: boolean;
};

export type CategoryUpdateInput = {
  name: string;
  active: boolean;
};

export function createCategory(input: CategoryInput): Category {
  const id = input.id.trim();
  const name = input.name.trim();

  if (id === "") {
    throw new Error("Category id is required");
  }

  if (name === "") {
    throw new Error("Category name is required");
  }

  return { id, name, active: input.active ?? true };
}

export function normalizeCategoryName(value: string): string {
  return normalizeCanonicalText(value);
}

export function assertUniqueCategoryName(categories: Category[], candidate: Category): void {
  const normalized = normalizeCategoryName(candidate.name);
  if (
    categories.some(
      (category) =>
        category.id !== candidate.id && normalizeCategoryName(category.name) === normalized,
    )
  ) {
    throw new Error("Category name already exists");
  }
}

export function updateCategory(category: Category, input: CategoryUpdateInput): Category {
  return createCategory({
    id: category.id,
    name: input.name,
    active: input.active,
  });
}
