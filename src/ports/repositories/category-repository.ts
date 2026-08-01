import type { Category } from "../../core/categories/category.js";

export type CategoryRepository = {
  list(): Promise<Category[]>;
  listActive(): Promise<Category[]>;
  get(id: string): Promise<Category | null>;
  save(category: Category): Promise<void>;
};
