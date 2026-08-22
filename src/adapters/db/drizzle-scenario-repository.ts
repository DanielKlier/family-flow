import { eq, sql } from "drizzle-orm";
import {
  assertAdjustmentWithinScenario,
  createScenario,
  createScenarioAdjustment,
  type Scenario,
  type ScenarioAdjustment,
} from "../../core/scenarios/scenario.js";
import { calculateScenario } from "../../core/scenarios/scenario-calculator.js";
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
      await lockScenario(transaction, scenario.id);
      await upsertScenario(transaction, scenario);
      calculateScenario(scenario, adjustments);
      await transaction
        .delete(scenarioAdjustments)
        .where(eq(scenarioAdjustments.scenarioId, scenario.id));
      if (adjustments.length > 0) await transaction.insert(scenarioAdjustments).values(adjustments);
    });
  }

  async saveScenario(scenario: Scenario): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await lockScenario(transaction, scenario.id);
      await upsertScenario(transaction, scenario);
      const rows = await transaction
        .select()
        .from(scenarioAdjustments)
        .where(eq(scenarioAdjustments.scenarioId, scenario.id));
      const adjustments = rows.map(createScenarioAdjustment);
      for (const adjustment of adjustments) assertAdjustmentWithinScenario(scenario, adjustment);
      calculateScenario(scenario, adjustments);
    });
  }

  async addAdjustment(adjustment: ScenarioAdjustment): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await lockScenario(transaction, adjustment.scenarioId);
      const rows = await transaction
        .select()
        .from(scenarios)
        .where(eq(scenarios.id, adjustment.scenarioId))
        .limit(1);
      if (rows[0] === undefined) throw new Error("Scenario does not exist");
      const scenario = mapScenario(rows[0]);
      assertAdjustmentWithinScenario(scenario, adjustment);
      const persistedAdjustments = await transaction
        .select()
        .from(scenarioAdjustments)
        .where(eq(scenarioAdjustments.scenarioId, adjustment.scenarioId));
      calculateScenario(scenario, [
        ...persistedAdjustments.map(createScenarioAdjustment),
        adjustment,
      ]);
      await transaction.insert(scenarioAdjustments).values(adjustment);
    });
  }

  async updateAdjustment(adjustment: ScenarioAdjustment): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await lockScenario(transaction, adjustment.scenarioId);
      const scenarioRows = await transaction
        .select()
        .from(scenarios)
        .where(eq(scenarios.id, adjustment.scenarioId))
        .limit(1);
      if (scenarioRows[0] === undefined) throw new Error("Scenario does not exist");
      const persisted = await transaction
        .select()
        .from(scenarioAdjustments)
        .where(eq(scenarioAdjustments.scenarioId, adjustment.scenarioId));
      if (!persisted.some(({ id }) => id === adjustment.id))
        throw new Error("Adjustment does not exist");
      const scenario = mapScenario(scenarioRows[0]);
      assertAdjustmentWithinScenario(scenario, adjustment);
      calculateScenario(
        scenario,
        persisted.map((row) =>
          row.id === adjustment.id ? adjustment : createScenarioAdjustment(row),
        ),
      );
      await transaction
        .update(scenarioAdjustments)
        .set(toAdjustmentRow(adjustment))
        .where(eq(scenarioAdjustments.id, adjustment.id));
    });
  }

  async deleteAdjustment(scenarioId: string, adjustmentId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await lockScenario(transaction, scenarioId);
      const persisted = await transaction
        .select({ id: scenarioAdjustments.id })
        .from(scenarioAdjustments)
        .where(eq(scenarioAdjustments.scenarioId, scenarioId));
      if (!persisted.some(({ id }) => id === adjustmentId))
        throw new Error("Adjustment does not exist");
      await transaction.delete(scenarioAdjustments).where(eq(scenarioAdjustments.id, adjustmentId));
    });
  }

  private async required(id: string): Promise<StoredScenario> {
    const item = await this.get(id);
    if (item === null) throw new Error("Persisted scenario disappeared");
    return item;
  }
}

async function lockScenario(
  db: Pick<PostgresDatabase, "execute">,
  scenarioId: string,
): Promise<void> {
  await db.execute(sql`select id from scenarios where id = ${scenarioId} for update`);
}

async function upsertScenario(
  db: Pick<PostgresDatabase, "insert">,
  scenario: Scenario,
): Promise<void> {
  await db
    .insert(scenarios)
    .values(toRow(scenario))
    .onConflictDoUpdate({ target: scenarios.id, set: toRow(scenario) });
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
function toAdjustmentRow(adjustment: ScenarioAdjustment): typeof scenarioAdjustments.$inferInsert {
  return adjustment;
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
