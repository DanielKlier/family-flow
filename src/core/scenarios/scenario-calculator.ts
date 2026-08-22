import { compareCodePoints } from "../shared/compare-code-points.js";
import {
  assertAdjustmentWithinScenario,
  listScenarioMonths,
  type Scenario,
  type ScenarioAdjustment,
} from "./scenario.js";

export type ScenarioMonthResult = {
  month: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  bufferCents: number;
  fundingGapCents: number;
  adjustments: string[];
};

export type ScenarioResult = {
  months: ScenarioMonthResult[];
  lowestBufferCents: number;
  requiredAdditionalNetIncomeCents: number;
};

export function calculateScenario(
  scenario: Scenario,
  adjustments: ScenarioAdjustment[],
): ScenarioResult {
  for (const adjustment of adjustments) assertAdjustmentWithinScenario(scenario, adjustment);
  const ordered = [...adjustments].sort((left, right) => compareCodePoints(left.id, right.id));
  let bufferCents = scenario.startingBufferCents;
  let lowestBufferCents = bufferCents;
  let requiredAdditionalNetIncomeCents = 0;
  const months = listScenarioMonths(scenario.startMonth, scenario.endMonth).map((month) => {
    const active = ordered.filter(
      (adjustment) => adjustment.startMonth <= month && adjustment.endMonth >= month,
    );
    const incomeCents = addDeltas(scenario.baseIncomeCents, active, "income");
    const expenseCents = addDeltas(scenario.baseline.expenseCents, active, "expense");
    if (incomeCents < 0) throw new Error("Monthly income must be non-negative");
    if (expenseCents < 0) throw new Error("Monthly expense must be non-negative");
    const balanceCents = safeAdd(incomeCents, -expenseCents);
    bufferCents = safeAdd(bufferCents, balanceCents);
    const fundingGapCents = Math.max(0, -balanceCents);
    lowestBufferCents = Math.min(lowestBufferCents, bufferCents);
    requiredAdditionalNetIncomeCents = Math.max(requiredAdditionalNetIncomeCents, fundingGapCents);
    return {
      month,
      incomeCents,
      expenseCents,
      balanceCents,
      bufferCents,
      fundingGapCents,
      adjustments: active.map(({ id }) => id),
    };
  });
  return { months, lowestBufferCents, requiredAdditionalNetIncomeCents };
}

function addDeltas(
  baseline: number,
  adjustments: ScenarioAdjustment[],
  type: ScenarioAdjustment["type"],
): number {
  return adjustments
    .filter((adjustment) => adjustment.type === type)
    .reduce((total, adjustment) => safeAdd(total, adjustment.deltaCents), baseline);
}
function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new Error("Scenario calculation must remain a safe integer");
  return result;
}
