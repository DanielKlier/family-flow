import type { CategorizationRule } from "../../core/categorization/categorization-rule.js";
import type { CategorizationRuleRepository } from "../../ports/repositories/categorization-rule-repository.js";

export class InMemoryCategorizationRuleRepository implements CategorizationRuleRepository {
  readonly #rules = new Map<string, CategorizationRule>();

  constructor(rules: CategorizationRule[] = []) {
    for (const rule of rules) {
      this.#rules.set(rule.id, rule);
    }
  }

  async list(): Promise<CategorizationRule[]> {
    return [...this.#rules.values()].sort(compareRules);
  }

  async get(id: string): Promise<CategorizationRule | null> {
    return this.#rules.get(id) ?? null;
  }

  async save(rule: CategorizationRule): Promise<void> {
    this.#rules.set(rule.id, rule);
  }

  async delete(id: string): Promise<void> {
    this.#rules.delete(id);
  }
}

function compareRules(left: CategorizationRule, right: CategorizationRule): number {
  return left.priority - right.priority || left.name.localeCompare(right.name);
}
