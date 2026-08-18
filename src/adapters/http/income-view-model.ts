import type {
  IncomePlan,
  MonthlyIncomeOverride,
  MonthlyIncomeResult,
} from "../../core/income/income-plan.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { IncomePageFilters } from "./income-request.js";

export type IncomeViewInput = {
  plans: IncomePlan[];
  allPlans: IncomePlan[];
  overrides: MonthlyIncomeOverride[];
  ownerContexts: OwnerContextLabel[];
  filters: IncomePageFilters;
  monthlyIncome: MonthlyIncomeResult;
  formError?: string;
};

function ownerOptions(ownerContexts: OwnerContextLabel[], selected?: string) {
  return ownerContexts.map(({ ownerContext, label }) => ({
    value: ownerContext,
    label,
    selected: ownerContext === selected,
  }));
}

function prepareIncomeForm(
  ownerContexts: OwnerContextLabel[],
  localization: Localization,
  plan?: IncomePlan,
  formError?: string,
) {
  const actionUrl = plan === undefined ? "/income" : `/income/${encodeURIComponent(plan.id)}`;
  return {
    heading: localization.text(plan === undefined ? "income.add" : "income.edit"),
    actionUrl,
    submitLabel: localization.text(plan === undefined ? "income.add" : "income.save"),
    name: plan?.name ?? "",
    amount: plan === undefined ? "" : localization.formatAmount(plan.amountCents),
    startMonth: plan === undefined ? "" : localization.formatMonth(plan.startMonth),
    endMonth:
      plan?.endMonth === null || plan?.endMonth === undefined
        ? ""
        : localization.formatMonth(plan.endMonth),
    activeChecked: plan?.active ?? true,
    ownerContexts: ownerOptions(ownerContexts, plan?.ownerContext),
    formError,
  };
}

function incomeText(localization: Localization) {
  const text = (key: string) => localization.text(key);
  return {
    name: text("income.label"),
    ownerContext: text("common.owner"),
    amount: text("common.amount"),
    startMonth: text("income.startMonth"),
    endMonth: text("income.endMonth"),
    active: text("common.active"),
    monthPlaceholder: text("transaction.monthPlaceholder"),
    overrideHeading: text("income.overrideHeading"),
    overrideIncome: text("income.overrideIncome"),
    overrideMonth: text("common.month"),
    overrideAmount: text("income.overrideAmount"),
    overrideNote: text("income.overrideNote"),
    saveOverride: text("income.saveOverride"),
    filtersHeading: text("income.filters"),
    calculationMonth: text("income.calculationMonth"),
    filterOwner: text("income.filterOwner"),
    applyFilters: text("income.applyFilters"),
    updateCalculation: text("income.updateCalculation"),
    summaryHeading: text("income.summary"),
    listHeading: text("income.list"),
    noPlans: text("income.empty"),
    owner: text("common.owner"),
    start: text("income.start"),
    end: text("income.end"),
    actions: text("common.actions"),
    edit: text("common.edit"),
    activate: text("income.activate"),
    deactivate: text("income.deactivate"),
    overridesHeading: text("income.overrides"),
    noOverrides: text("income.noOverrides"),
    month: text("common.month"),
    income: text("income.overrideIncome"),
    note: text("common.note"),
  };
}

export function prepareIncomeViewModel(input: IncomeViewInput, localization: Localization) {
  const owners = new Map(
    input.ownerContexts.map(({ ownerContext, label }) => [ownerContext, label]),
  );
  const plans = new Map(input.allPlans.map(({ id, name }) => [id, name]));
  return {
    title: localization.text("income.title"),
    heading: localization.text("income.heading"),
    text: incomeText(localization),
    form: prepareIncomeForm(input.ownerContexts, localization, undefined, input.formError),
    planOptions: input.allPlans.map(({ id, name }) => ({ value: id, label: name })),
    filterMonth: localization.formatMonth(input.filters.month),
    ownerContexts: ownerOptions(input.ownerContexts, input.filters.ownerContext).map(
      ({ value, selected }) => ({ value, selected }),
    ),
    ownerContextOptions: [
      {
        value: "",
        label: localization.text("common.allOwners"),
        selected: input.filters.ownerContext === undefined,
      },
      ...ownerOptions(input.ownerContexts, input.filters.ownerContext),
    ],
    monthlyIncomeLabel: localization.text("income.monthlyTotal", {
      amount: localization.formatAmount(input.monthlyIncome.totalCents),
    }),
    empty: input.plans.length === 0,
    rows: input.plans.map((plan) => ({
      name: plan.name,
      ownerLabel: owners.get(plan.ownerContext) ?? plan.ownerContext,
      amount: localization.formatAmount(plan.amountCents),
      startMonth: localization.formatMonth(plan.startMonth),
      endMonth: plan.endMonth === null ? "" : localization.formatMonth(plan.endMonth),
      editUrl: `/income/${encodeURIComponent(plan.id)}/edit`,
      activationUrl: `/income/${encodeURIComponent(plan.id)}/${plan.active ? "deactivate" : "activate"}`,
      activationLabel: localization.text(plan.active ? "income.deactivate" : "income.activate"),
    })),
    overridesEmpty: input.overrides.length === 0,
    overrides: input.overrides.map((override) => ({
      month: localization.formatMonth(override.month),
      incomeName: plans.get(override.incomePlanId) ?? override.incomePlanId,
      amount: localization.formatAmount(override.amountCents),
      note: override.note ?? "",
    })),
  };
}

export function prepareIncomeEditViewModel(
  input: {
    plan: IncomePlan;
    ownerContexts: OwnerContextLabel[];
    formError?: string;
  },
  localization: Localization,
) {
  return {
    title: localization.text("income.edit"),
    text: incomeText(localization),
    ...prepareIncomeForm(input.ownerContexts, localization, input.plan, input.formError),
    heading: localization.text("income.edit"),
  };
}
