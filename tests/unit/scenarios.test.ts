import { describe, expect, it } from "vitest";

import {
  createHistoricalBaselineSnapshot,
  createScenario,
  assertAdjustmentWithinScenario,
  createScenarioAdjustment,
  updateScenario,
} from "../../src/core/scenarios/scenario.js";
import { calculateScenario } from "../../src/core/scenarios/scenario-calculator.js";
import { aTransaction } from "../support/transactions.js";

const scenarioInput = {
  id: "scenario-parental-leave",
  name: "  Parental leave  ",
  startMonth: "2026-08",
  endMonth: "2028-01",
  startingBufferCents: 10_000,
  baseIncomeCents: 100_000,
  baseline: { mode: "manual" as const, expenseCents: 70_000 },
};

describe("family-finance scenarios", () => {
  it("UNIT-FF-SCN-001-01 canonicalizes scenario fields, permits exactly 18 or 24 inclusive months, and snapshots completed historical months", () => {
    expect(createScenario(scenarioInput)).toMatchObject({
      name: "Parental leave",
      startMonth: "2026-08",
      endMonth: "2028-01",
      baseline: { mode: "manual", expenseCents: 70_000 },
    });
    expect(() => createScenario({ ...scenarioInput, endMonth: "2028-02" })).toThrow(
      "Scenario duration must be 18 or 24 months",
    );
    expect(() => createScenario({ ...scenarioInput, endMonth: "2027-12" })).toThrow(
      "Scenario duration must be 18 or 24 months",
    );
    expect(() =>
      createScenario({ ...scenarioInput, startMonth: "2028-01", endMonth: "2026-08" }),
    ).toThrow("Scenario end month must not precede start month");
    expect(() => createScenario({ ...scenarioInput, baseIncomeCents: -1 })).toThrow(
      "Scenario base income must be non-negative",
    );

    expect(
      createHistoricalBaselineSnapshot(
        [
          aTransaction({ date: "2026-04-01", amountCents: -30_000 }),
          aTransaction({ date: "2026-06-01", amountCents: -60_000 }),
          aTransaction({ date: "2026-05-01", amountCents: -99_000, internalTransfer: true }),
        ],
        "2026-07",
        3,
      ),
    ).toEqual({ mode: "historical", windowLength: 3, expenseCents: 30_000 });
  });

  it("UNIT-FF-SCN-002-01 applies signed adjustments inclusively in deterministic ID order and rejects ranges outside the scenario", () => {
    const scenario = createScenario(scenarioInput);
    const late = createScenarioAdjustment({
      id: "z-expense",
      scenarioId: scenario.id,
      name: " Daycare ",
      type: "expense",
      deltaCents: 20_000,
      startMonth: "2026-08",
      endMonth: "2026-08",
    });
    const first = createScenarioAdjustment({
      id: "a-income",
      scenarioId: scenario.id,
      name: "Benefit",
      type: "income",
      deltaCents: -10_000,
      startMonth: "2026-08",
      endMonth: "2028-01",
    });
    expect(calculateScenario(scenario, [late, first]).months[0]).toMatchObject({
      month: "2026-08",
      incomeCents: 90_000,
      expenseCents: 90_000,
      adjustments: ["a-income", "z-expense"],
    });
    expect(calculateScenario(scenario, [late, first]).months.at(-1)).toMatchObject({
      month: "2028-01",
      incomeCents: 90_000,
      expenseCents: 70_000,
    });
    expect(() =>
      assertAdjustmentWithinScenario(scenario, {
        ...createScenarioAdjustment({ ...first, id: "outside", startMonth: "2026-07" }),
      }),
    ).toThrow("Adjustment range must be within the scenario range");
  });

  it("UNIT-FF-SCN-002-02 rejects a scenario range edit that would orphan a retained adjustment", () => {
    const scenario = createScenario(scenarioInput);
    const adjustment = createScenarioAdjustment({
      id: "retained-end",
      scenarioId: scenario.id,
      name: "Child benefit",
      type: "income",
      deltaCents: 1,
      startMonth: "2028-01",
      endMonth: "2028-01",
    });
    expect(() => updateScenario(scenario, { endMonth: "2027-12" }, [adjustment])).toThrow(
      "Scenario range would exclude retained adjustment",
    );
  });

  it("UNIT-FF-SCN-004-01 UNIT-FF-SCN-004-02 calculates exact monthly balances, buffers, funding gaps, and required additional income", () => {
    const scenario = createScenario(scenarioInput);
    const result = calculateScenario(scenario, [
      createScenarioAdjustment({
        id: "income",
        scenarioId: scenario.id,
        name: "Benefit",
        type: "income",
        deltaCents: 10_000,
        startMonth: "2026-08",
        endMonth: "2026-08",
      }),
      createScenarioAdjustment({
        id: "expense",
        scenarioId: scenario.id,
        name: "Child cost",
        type: "expense",
        deltaCents: 20_000,
        startMonth: "2026-09",
        endMonth: "2026-09",
      }),
    ]);
    expect(result.months.slice(0, 2)).toMatchObject([
      {
        month: "2026-08",
        incomeCents: 110_000,
        expenseCents: 70_000,
        balanceCents: 40_000,
        bufferCents: 50_000,
        fundingGapCents: 0,
      },
      {
        month: "2026-09",
        incomeCents: 100_000,
        expenseCents: 90_000,
        balanceCents: 10_000,
        bufferCents: 60_000,
        fundingGapCents: 0,
      },
    ]);
    expect(result.lowestBufferCents).toBe(10_000);
    expect(result.requiredAdditionalNetIncomeCents).toBe(0);

    const deficit = calculateScenario(
      createScenario({ ...scenarioInput, startingBufferCents: 10_000, baseIncomeCents: 10_000 }),
      [],
    );
    expect(deficit.months.slice(0, 2)).toMatchObject([
      { balanceCents: -60_000, bufferCents: -50_000, fundingGapCents: 50_000 },
      { bufferCents: -110_000, fundingGapCents: 110_000 },
    ]);
    expect(deficit.lowestBufferCents).toBe(-1_070_000);
    expect(deficit.requiredAdditionalNetIncomeCents).toBe(1_070_000);
  });

  it("UNIT-FF-SCN-005-01 permits zero totals but rejects negative derived totals and unsafe arithmetic", () => {
    const scenario = createScenario({
      ...scenarioInput,
      baseIncomeCents: 0,
      baseline: { mode: "manual", expenseCents: 0 },
    });
    expect(calculateScenario(scenario, []).months[0]).toMatchObject({
      incomeCents: 0,
      expenseCents: 0,
    });
    expect(() =>
      calculateScenario(scenario, [
        createScenarioAdjustment({
          id: "negative-income",
          scenarioId: scenario.id,
          name: "Loss",
          type: "income",
          deltaCents: -1,
          startMonth: "2026-08",
          endMonth: "2026-08",
        }),
      ]),
    ).toThrow("Monthly income must be non-negative");
    expect(() =>
      calculateScenario(
        createScenario({ ...scenarioInput, baseIncomeCents: Number.MAX_SAFE_INTEGER }),
        [
          createScenarioAdjustment({
            id: "overflow",
            scenarioId: scenario.id,
            name: "Overflow",
            type: "income",
            deltaCents: 1,
            startMonth: "2026-08",
            endMonth: "2026-08",
          }),
        ],
      ),
    ).toThrow("Scenario calculation must remain a safe integer");
  });
});
