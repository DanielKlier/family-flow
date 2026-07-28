import type { Category } from "../../core/categories/category.js";

export type CategoryRepository = {
  list(): Promise<Category[]>;
  save(category: Category): Promise<void>;
};
