export type Category = {
  id: string;
  name: string;
};

export function createCategory(input: Category): Category {
  const id = input.id.trim();
  const name = input.name.trim();

  if (id === "") {
    throw new Error("Category id is required");
  }

  if (name === "") {
    throw new Error("Category name is required");
  }

  return { id, name };
}
