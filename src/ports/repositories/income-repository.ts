import type { IncomePlan, MonthlyIncomeOverride } from "../../core/income/income-plan.js";
import type { OwnerContext } from "../../core/shared/owner-context.js";

export type IncomePlanFilters = {
  ownerContext?: OwnerContext;
};

export type MonthlyIncomeOverrideFilters = {
  month?: string;
  incomePlanId?: string;
};

export type IncomeRepository = {
  listPlans(filters: IncomePlanFilters): Promise<IncomePlan[]>;
  getPlan(id: string): Promise<IncomePlan | null>;
  savePlan(plan: IncomePlan): Promise<void>;
  listOverrides(filters: MonthlyIncomeOverrideFilters): Promise<MonthlyIncomeOverride[]>;
  saveOverride(override: MonthlyIncomeOverride): Promise<void>;
};
