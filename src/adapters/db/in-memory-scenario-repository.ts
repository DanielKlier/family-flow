import { compareCodePoints } from "../../core/shared/compare-code-points.js";
import { calculateScenario } from "../../core/scenarios/scenario-calculator.js";
import {
  assertAdjustmentWithinScenario,
  type Scenario,
  type ScenarioAdjustment,
} from "../../core/scenarios/scenario.js";
import type {
  ScenarioRepository,
  StoredScenario,
} from "../../ports/repositories/scenario-repository.js";

export class InMemoryScenarioRepository implements ScenarioRepository {
  readonly #items = new Map<string, StoredScenario>();

  async list(): Promise<StoredScenario[]> {
    return [...this.#items.values()].sort((left, right) =>
      compareCodePoints(left.scenario.name, right.scenario.name),
    );
  }
  async get(id: string): Promise<StoredScenario | null> {
    return this.#items.get(id) ?? null;
  }
  async save(scenario: Scenario, adjustments: ScenarioAdjustment[]): Promise<void> {
    calculateScenario(scenario, adjustments);
    this.#items.set(scenario.id, {
      scenario,
      adjustments: [...adjustments].sort((left, right) => compareCodePoints(left.id, right.id)),
    });
  }
  async saveScenario(scenario: Scenario): Promise<void> {
    const existing = this.#items.get(scenario.id);
    const adjustments = existing?.adjustments ?? [];
    for (const adjustment of adjustments) assertAdjustmentWithinScenario(scenario, adjustment);
    calculateScenario(scenario, adjustments);
    this.#items.set(scenario.id, { scenario, adjustments });
  }
  async addAdjustment(adjustment: ScenarioAdjustment): Promise<void> {
    const existing = this.#items.get(adjustment.scenarioId);
    if (existing === undefined) throw new Error("Scenario does not exist");
    assertAdjustmentWithinScenario(existing.scenario, adjustment);
    await this.save(existing.scenario, [...existing.adjustments, adjustment]);
  }
}
