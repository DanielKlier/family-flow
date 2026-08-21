import { asc, eq } from "drizzle-orm";

import {
  assertUniqueCategoryName,
  type Category,
  createCategory,
  normalizeCategoryName,
} from "../../core/categories/category.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { categories } from "./schema.js";

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async list(): Promise<Category[]> {
    const rows = await this.db.select().from(categories).orderBy(asc(categories.name));

    return rows.map(mapCategoryRow);
  }

  async listActive(): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.name));

    return rows.map(mapCategoryRow);
  }

  async get(id: string): Promise<Category | null> {
    const [row] = await this.db.select().from(categories).where(eq(categories.id, id));

    return row === undefined ? null : mapCategoryRow(row);
  }

  async save(category: Category): Promise<void> {
    assertUniqueCategoryName(await this.list(), category);
    await this.db
      .insert(categories)
      .values({ ...category, normalizedName: normalizeCategoryName(category.name) })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: category.name,
          normalizedName: normalizeCategoryName(category.name),
          active: category.active,
        },
      });
  }
}

type CategoryRow = typeof categories.$inferSelect;

function mapCategoryRow(row: CategoryRow): Category {
  return createCategory({
    id: row.id,
    name: row.name,
    active: row.active,
  });
}
