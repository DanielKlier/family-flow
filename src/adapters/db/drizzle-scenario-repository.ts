import { eq } from "drizzle-orm";

import {
  createScenario,
  createScenarioAdjustment,
  type Scenario,
  type ScenarioAdjustment,
} from "../../core/scenarios/scenario.js";
import type {
  ScenarioRepository,
  StoredScenario,
} from "../../ports/repositories/scenario-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { scenarioAdjustments, scenarios } from "./schema.js";

export class DrizzleScenarioRepository implements ScenarioRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async list(): Promise<StoredScenario[]> {
    const rows = await this.db.select().from(scenarios).orderBy(scenarios.name);
    return Promise.all(rows.map(({ id }) => this.required(id)));
  }

  async get(id: string): Promise<StoredScenario | null> {
    const rows = await this.db.select().from(scenarios).where(eq(scenarios.id, id)).limit(1);
    if (rows[0] === undefined) return null;
    const adjustments = await this.db
      .select()
      .from(scenarioAdjustments)
      .where(eq(scenarioAdjustments.scenarioId, id))
      .orderBy(scenarioAdjustments.id);
    return {
      scenario: mapScenario(rows[0]),
      adjustments: adjustments.map(createScenarioAdjustment),
    };
  }

  async save(scenario: Scenario, adjustments: ScenarioAdjustment[]): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction
        .insert(scenarios)
        .values(toRow(scenario))
        .onConflictDoUpdate({
          target: scenarios.id,
          set: toRow(scenario),
        });
      await transaction
        .delete(scenarioAdjustments)
        .where(eq(scenarioAdjustments.scenarioId, scenario.id));
      if (adjustments.length > 0) await transaction.insert(scenarioAdjustments).values(adjustments);
    });
  }

  private async required(id: string): Promise<StoredScenario> {
    const item = await this.get(id);
    if (item === null) throw new Error("Persisted scenario disappeared");
    return item;
  }
}

function toRow(scenario: Scenario): typeof scenarios.$inferInsert {
  return {
    id: scenario.id,
    name: scenario.name,
    startMonth: scenario.startMonth,
    endMonth: scenario.endMonth,
    startingBufferCents: scenario.startingBufferCents,
    baseIncomeCents: scenario.baseIncomeCents,
    baselineMode: scenario.baseline.mode,
    baselineWindowLength:
      scenario.baseline.mode === "historical" ? scenario.baseline.windowLength : null,
    baselineExpenseCents: scenario.baseline.expenseCents,
  };
}
function mapScenario(row: typeof scenarios.$inferSelect): Scenario {
  const baseline =
    row.baselineMode === "historical"
      ? {
          mode: "historical" as const,
          windowLength: requireWindow(row.baselineWindowLength),
          expenseCents: row.baselineExpenseCents,
        }
      : { mode: "manual" as const, expenseCents: row.baselineExpenseCents };
  return createScenario({
    id: row.id,
    name: row.name,
    startMonth: row.startMonth,
    endMonth: row.endMonth,
    startingBufferCents: row.startingBufferCents,
    baseIncomeCents: row.baseIncomeCents,
    baseline,
  });
}
function requireWindow(value: number | null): 3 | 6 | 12 {
  if (value === 3 || value === 6 || value === 12) return value;
  throw new Error("Persisted historical scenario window is invalid");
}
