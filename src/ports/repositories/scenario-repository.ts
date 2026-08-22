import type { Scenario, ScenarioAdjustment } from "../../core/scenarios/scenario.js";

export type StoredScenario = { scenario: Scenario; adjustments: ScenarioAdjustment[] };

export interface ScenarioRepository {
  list(): Promise<StoredScenario[]>;
  get(id: string): Promise<StoredScenario | null>;
  save(scenario: Scenario, adjustments: ScenarioAdjustment[]): Promise<void>;
  saveScenario(scenario: Scenario): Promise<void>;
  addAdjustment(adjustment: ScenarioAdjustment): Promise<void>;
  updateAdjustment(adjustment: ScenarioAdjustment): Promise<void>;
  deleteAdjustment(scenarioId: string, adjustmentId: string): Promise<void>;
}
