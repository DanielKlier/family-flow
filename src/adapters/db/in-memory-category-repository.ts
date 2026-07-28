import type { Category } from "../../core/categories/category.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";

export class InMemoryCategoryRepository implements CategoryRepository {
  readonly #categories = new Map<string, Category>();

  constructor(categories: Category[] = []) {
    for (const category of categories) {
      this.#categories.set(category.id, category);
    }
  }

  async list(): Promise<Category[]> {
    return [...this.#categories.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  async save(category: Category): Promise<void> {
    this.#categories.set(category.id, category);
  }
}
