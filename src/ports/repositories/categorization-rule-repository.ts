import type { CategorizationRule } from "../../core/categorization/categorization-rule.js";

export type CategorizationRuleRepository = {
  list(): Promise<CategorizationRule[]>;
  get(id: string): Promise<CategorizationRule | null>;
  save(rule: CategorizationRule): Promise<void>;
  delete(id: string): Promise<void>;
};
