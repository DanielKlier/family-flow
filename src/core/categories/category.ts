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

export function updateCategory(category: Category, input: CategoryUpdateInput): Category {
  return createCategory({
    id: category.id,
    name: input.name,
    active: input.active,
  });
}
