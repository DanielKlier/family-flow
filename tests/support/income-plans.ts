import {
  createIncomePlan,
  type IncomePlan,
  type IncomePlanInput,
} from "../../src/core/income/income-plan.js";

export function anIncomePlan(overrides: Partial<IncomePlanInput> = {}): IncomePlan {
  return createIncomePlan({
    id: "income-1",
    ownerContext: "person_a",
    name: "Salary",
    amountCents: 350000,
    startMonth: "2026-01",
    endMonth: null,
    active: true,
    ...overrides,
  });
}
