import { calculateScenario } from "../../core/scenarios/scenario-calculator.js";
import type { Scenario, ScenarioAdjustment } from "../../core/scenarios/scenario.js";
import type { Localization } from "../../ports/localization/localization.js";

export type ScenarioViewInput = {
  items: { scenario: Scenario; adjustments: ScenarioAdjustment[] }[];
  selected?: { scenario: Scenario; adjustments: ScenarioAdjustment[] };
  formError?: string;
};

export function prepareScenarioViewModel(input: ScenarioViewInput, l: Localization) {
  const selected = input.selected;
  const result =
    selected === undefined ? null : calculateScenario(selected.scenario, selected.adjustments);
  return {
    title: l.text("scenario.title"),
    heading: l.text("scenario.heading"),
    formError: input.formError,
    text: {
      create: l.text("scenario.create"),
      name: l.text("scenario.name"),
      startMonth: l.text("scenario.startMonth"),
      endMonth: l.text("scenario.endMonth"),
      startingBuffer: l.text("scenario.startingBuffer"),
      baseIncome: l.text("scenario.baseIncome"),
      baseline: l.text("scenario.baseline"),
      baselineChoice: l.text("scenario.baselineChoice"),
      manual: l.text("scenario.manualBaseline"),
      historical3: l.text("scenario.historical3"),
      historical6: l.text("scenario.historical6"),
      historical12: l.text("scenario.historical12"),
      save: l.text("scenario.save"),
      adjustment: l.text("scenario.adjustment"),
      type: l.text("scenario.type"),
      income: l.text("scenario.income"),
      expense: l.text("scenario.expense"),
      direction: l.text("scenario.direction"),
      increase: l.text("scenario.increase"),
      decrease: l.text("scenario.decrease"),
      amount: l.text("common.amount"),
      from: l.text("scenario.from"),
      to: l.text("scenario.to"),
      add: l.text("scenario.add"),
      lowestBuffer: l.text("scenario.lowestBuffer"),
      requiredIncome: l.text("scenario.requiredIncome"),
      month: l.text("common.month"),
      balance: l.text("scenario.balance"),
      buffer: l.text("scenario.buffer"),
      empty: l.text("scenario.empty"),
      monthPlaceholder: l.text("transaction.monthPlaceholder"),
      amountPlaceholder: l.text("transaction.amountPlaceholder"),
      edit: l.text("scenario.edit"),
      update: l.text("scenario.update"),
      preserveBaseline: l.text("scenario.preserveBaseline"),
      list: l.text("scenario.list"),
    },
    list: input.items.map(({ scenario }) => ({
      name: scenario.name,
      href: `/scenarios?id=${encodeURIComponent(scenario.id)}`,
    })),
    selected:
      selected === undefined || result === null
        ? null
        : {
            id: selected.scenario.id,
            name: selected.scenario.name,
            startMonth: l.formatMonth(selected.scenario.startMonth),
            endMonth: l.formatMonth(selected.scenario.endMonth),
            startingBuffer: l.formatAmount(selected.scenario.startingBufferCents),
            baseIncome: l.formatAmount(selected.scenario.baseIncomeCents),
            baseline: l.text("scenario.baselineValue", {
              amount: l.formatAmount(selected.scenario.baseline.expenseCents),
            }),
            lowestBuffer: l.formatAmount(result.lowestBufferCents),
            requiredIncome: l.formatAmount(result.requiredAdditionalNetIncomeCents),
            adjustments: selected.adjustments.map((adjustment) => ({
              name: adjustment.name,
              amount: l.formatAmount(adjustment.deltaCents),
            })),
            months: result.months.map((month) => ({
              month: l.formatMonth(month.month),
              income: l.formatAmount(month.incomeCents),
              expense: l.formatAmount(month.expenseCents),
              balance: l.formatAmount(month.balanceCents),
              buffer: l.formatAmount(month.bufferCents),
            })),
          },
  };
}

export function prepareCalculatorViewModel(l: Localization) {
  return {
    title: l.text("calculator.title"),
    heading: l.text("calculator.heading"),
    intro: l.text("calculator.intro"),
    parental: l.text("calculator.parental"),
    tax: l.text("calculator.tax"),
  };
}
