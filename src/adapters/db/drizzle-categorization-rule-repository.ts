import { asc, eq } from "drizzle-orm";

import {
  type CategorizationRule,
  createCategorizationRule,
} from "../../core/categorization/categorization-rule.js";
import type { CategorizationRuleRepository } from "../../ports/repositories/categorization-rule-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { categorizationRules } from "./schema.js";

export class DrizzleCategorizationRuleRepository implements CategorizationRuleRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async list(): Promise<CategorizationRule[]> {
    const rows = await this.db
      .select()
      .from(categorizationRules)
      .orderBy(asc(categorizationRules.priority), asc(categorizationRules.name));

    return rows.map(mapCategorizationRuleRow);
  }

  async get(id: string): Promise<CategorizationRule | null> {
    const [row] = await this.db
      .select()
      .from(categorizationRules)
      .where(eq(categorizationRules.id, id));

    return row === undefined ? null : mapCategorizationRuleRow(row);
  }

  async save(rule: CategorizationRule): Promise<void> {
    await this.db
      .insert(categorizationRules)
      .values(rule)
      .onConflictDoUpdate({
        target: categorizationRules.id,
        set: {
          name: rule.name,
          searchText: rule.searchText,
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          fixedCost: rule.fixedCost,
          internalTransfer: rule.internalTransfer,
          priority: rule.priority,
          enabled: rule.enabled,
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(categorizationRules).where(eq(categorizationRules.id, id));
  }
}

type CategorizationRuleRow = typeof categorizationRules.$inferSelect;

function mapCategorizationRuleRow(row: CategorizationRuleRow): CategorizationRule {
  return createCategorizationRule({
    id: row.id,
    name: row.name,
    searchText: row.searchText,
    categoryId: row.categoryId,
    accountId: row.accountId,
    fixedCost: row.fixedCost,
    internalTransfer: row.internalTransfer,
    priority: row.priority,
    enabled: row.enabled,
  });
}
