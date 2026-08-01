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
    return sortCategories([...this.#categories.values()]);
  }

  async listActive(): Promise<Category[]> {
    return sortCategories([...this.#categories.values()].filter((category) => category.active));
  }

  async get(id: string): Promise<Category | null> {
    return this.#categories.get(id) ?? null;
  }

  async save(category: Category): Promise<void> {
    this.#categories.set(category.id, category);
  }
}

function sortCategories(categories: Category[]): Category[] {
  return categories.sort((left, right) => left.name.localeCompare(right.name));
}
