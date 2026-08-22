import { calculateHistoricalAverage } from "../dashboard/dashboard.js";
import type { Transaction } from "../transactions/transaction.js";

export type HistoricalScenarioBaseline = {
  mode: "historical";
  windowLength: 3 | 6 | 12;
  expenseCents: number;
};
export type ManualScenarioBaseline = { mode: "manual"; expenseCents: number };
export type ScenarioBaseline = HistoricalScenarioBaseline | ManualScenarioBaseline;

export type Scenario = {
  id: string;
  name: string;
  startMonth: string;
  endMonth: string;
  startingBufferCents: number;
  baseIncomeCents: number;
  baseline: ScenarioBaseline;
};

export type ScenarioAdjustment = {
  id: string;
  scenarioId: string;
  name: string;
  type: "income" | "expense";
  deltaCents: number;
  startMonth: string;
  endMonth: string;
};

export function createScenario(input: Scenario): Scenario {
  const scenario = { ...input, id: input.id.trim(), name: input.name.trim() };
  if (scenario.id === "") throw new Error("Scenario ID is required");
  if (scenario.name === "") throw new Error("Scenario name is required");
  assertMonth(scenario.startMonth);
  assertMonth(scenario.endMonth);
  if (scenario.endMonth < scenario.startMonth)
    throw new Error("Scenario end month must not precede start month");
  const duration = inclusiveMonthCount(scenario.startMonth, scenario.endMonth);
  if (duration < 18 || duration > 24)
    throw new Error("Scenario duration must be between 18 and 24 months");
  assertNonNegativeSafe(scenario.startingBufferCents, "Scenario starting buffer");
  assertNonNegativeSafe(scenario.baseIncomeCents, "Scenario base income");
  assertNonNegativeSafe(scenario.baseline.expenseCents, "Scenario expense baseline");
  if (
    scenario.baseline.mode === "historical" &&
    ![3, 6, 12].includes(scenario.baseline.windowLength)
  )
    throw new Error("Historical window must be 3, 6, or 12 months");
  return scenario;
}

export function createHistoricalBaselineSnapshot(
  transactions: Transaction[],
  currentMonth: string,
  windowLength: 3 | 6 | 12,
): HistoricalScenarioBaseline {
  return {
    mode: "historical",
    windowLength,
    expenseCents: calculateHistoricalAverage(transactions, currentMonth, windowLength),
  };
}

export function createScenarioAdjustment(input: ScenarioAdjustment): ScenarioAdjustment {
  const adjustment = { ...input, id: input.id.trim(), name: input.name.trim() };
  if (adjustment.id === "" || adjustment.scenarioId.trim() === "")
    throw new Error("Adjustment IDs are required");
  if (adjustment.name === "") throw new Error("Adjustment name is required");
  if (adjustment.type !== "income" && adjustment.type !== "expense")
    throw new Error("Adjustment type is invalid");
  assertMonth(adjustment.startMonth);
  assertMonth(adjustment.endMonth);
  if (adjustment.endMonth < adjustment.startMonth)
    throw new Error("Adjustment end month must not precede start month");
  if (!Number.isSafeInteger(adjustment.deltaCents))
    throw new Error("Adjustment delta must be a safe integer");
  return adjustment;
}

export function assertAdjustmentWithinScenario(
  scenario: Scenario,
  adjustment: ScenarioAdjustment,
): void {
  if (
    adjustment.scenarioId !== scenario.id ||
    adjustment.startMonth < scenario.startMonth ||
    adjustment.endMonth > scenario.endMonth
  )
    throw new Error("Adjustment range must be within the scenario range");
}

export function updateScenario(
  existing: Scenario,
  changes: Partial<Omit<Scenario, "id">>,
  retainedAdjustments: ScenarioAdjustment[],
): Scenario {
  const candidate = { ...existing, ...changes };
  if (
    retainedAdjustments.some(
      (adjustment) =>
        adjustment.startMonth < candidate.startMonth || adjustment.endMonth > candidate.endMonth,
    )
  )
    throw new Error("Scenario range would exclude retained adjustment");
  return createScenario(candidate);
}

export function listScenarioMonths(startMonth: string, endMonth: string): string[] {
  const [year, month] = startMonth.split("-").map(Number);
  return Array.from({ length: inclusiveMonthCount(startMonth, endMonth) }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function inclusiveMonthCount(start: string, end: string): number {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear - startYear) * 12 + endMonth - startMonth + 1;
}
function assertMonth(value: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Month must use YYYY-MM");
}
function assertNonNegativeSafe(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  if (value < 0) throw new Error(`${label} must be non-negative`);
}
