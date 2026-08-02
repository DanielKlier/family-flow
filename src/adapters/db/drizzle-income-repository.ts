import { and, eq } from "drizzle-orm";

import {
  createIncomePlan,
  createMonthlyIncomeOverride,
  type IncomePlan,
  type MonthlyIncomeOverride,
} from "../../core/income/income-plan.js";
import type {
  IncomePlanFilters,
  IncomeRepository,
  MonthlyIncomeOverrideFilters,
} from "../../ports/repositories/income-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { incomePlans, monthlyIncomeOverrides } from "./schema.js";

export class DrizzleIncomeRepository implements IncomeRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async listPlans(filters: IncomePlanFilters): Promise<IncomePlan[]> {
    const conditions = [];
    if (filters.ownerContext !== undefined) {
      conditions.push(eq(incomePlans.ownerContext, filters.ownerContext));
    }

    const rows = await this.db
      .select()
      .from(incomePlans)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(incomePlans.name);

    return rows.map(mapIncomePlan);
  }

  async getPlan(id: string): Promise<IncomePlan | null> {
    const rows = await this.db.select().from(incomePlans).where(eq(incomePlans.id, id)).limit(1);

    return rows[0] === undefined ? null : mapIncomePlan(rows[0]);
  }

  async savePlan(plan: IncomePlan): Promise<void> {
    await this.db
      .insert(incomePlans)
      .values(plan)
      .onConflictDoUpdate({
        target: incomePlans.id,
        set: {
          ownerContext: plan.ownerContext,
          name: plan.name,
          amountCents: plan.amountCents,
          startMonth: plan.startMonth,
          endMonth: plan.endMonth,
          active: plan.active,
        },
      });
  }

  async listOverrides(filters: MonthlyIncomeOverrideFilters): Promise<MonthlyIncomeOverride[]> {
    const conditions = [];
    if (filters.month !== undefined) {
      conditions.push(eq(monthlyIncomeOverrides.month, filters.month));
    }
    if (filters.incomePlanId !== undefined) {
      conditions.push(eq(monthlyIncomeOverrides.incomePlanId, filters.incomePlanId));
    }

    const rows = await this.db
      .select()
      .from(monthlyIncomeOverrides)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(monthlyIncomeOverrides.month);

    return rows.map(mapMonthlyIncomeOverride);
  }

  async saveOverride(override: MonthlyIncomeOverride): Promise<void> {
    await this.db
      .insert(monthlyIncomeOverrides)
      .values(override)
      .onConflictDoUpdate({
        target: monthlyIncomeOverrides.id,
        set: {
          incomePlanId: override.incomePlanId,
          month: override.month,
          amountCents: override.amountCents,
          note: override.note,
        },
      });
  }
}

function mapIncomePlan(row: typeof incomePlans.$inferSelect): IncomePlan {
  return createIncomePlan(row);
}

function mapMonthlyIncomeOverride(
  row: typeof monthlyIncomeOverrides.$inferSelect,
): MonthlyIncomeOverride {
  return createMonthlyIncomeOverride(row);
}
