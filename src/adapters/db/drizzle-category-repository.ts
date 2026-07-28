import { asc } from "drizzle-orm";

import { createCategory, type Category } from "../../core/categories/category.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { categories } from "./schema.js";

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async list(): Promise<Category[]> {
    const rows = await this.db.select().from(categories).orderBy(asc(categories.name));

    return rows.map((row) =>
      createCategory({
        id: row.id,
        name: row.name,
      }),
    );
  }

  async save(category: Category): Promise<void> {
    await this.db
      .insert(categories)
      .values(category)
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: category.name,
        },
      });
  }
}
