import { compareCodePoints } from "../../core/shared/compare-code-points.js";
import type { Scenario, ScenarioAdjustment } from "../../core/scenarios/scenario.js";
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
    this.#items.set(scenario.id, {
      scenario,
      adjustments: [...adjustments].sort((left, right) => compareCodePoints(left.id, right.id)),
    });
  }
}
