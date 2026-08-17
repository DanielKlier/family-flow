import type { IncomePlan, MonthlyIncomeOverride } from "../../core/income/income-plan.js";
import { compareCodePoints } from "../../core/shared/compare-code-points.js";
import type {
  IncomePlanFilters,
  IncomeRepository,
  MonthlyIncomeOverrideFilters,
} from "../../ports/repositories/income-repository.js";

export class InMemoryIncomeRepository implements IncomeRepository {
  readonly #plans = new Map<string, IncomePlan>();
  readonly #overrides = new Map<string, MonthlyIncomeOverride>();

  async listPlans(filters: IncomePlanFilters): Promise<IncomePlan[]> {
    return [...this.#plans.values()]
      .filter(
        (plan) => filters.ownerContext === undefined || plan.ownerContext === filters.ownerContext,
      )
      .sort((left, right) => compareCodePoints(left.name, right.name));
  }

  async getPlan(id: string): Promise<IncomePlan | null> {
    return this.#plans.get(id) ?? null;
  }

  async savePlan(plan: IncomePlan): Promise<void> {
    this.#plans.set(plan.id, plan);
  }

  async listOverrides(filters: MonthlyIncomeOverrideFilters): Promise<MonthlyIncomeOverride[]> {
    return [...this.#overrides.values()]
      .filter((override) => filters.month === undefined || override.month === filters.month)
      .filter(
        (override) =>
          filters.incomePlanId === undefined || override.incomePlanId === filters.incomePlanId,
      )
      .sort((left, right) => compareCodePoints(right.month, left.month));
  }

  async saveOverride(override: MonthlyIncomeOverride): Promise<void> {
    this.#overrides.set(override.id, override);
  }
}
