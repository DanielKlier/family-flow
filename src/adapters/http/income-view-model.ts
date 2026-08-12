import type {
  IncomePlan,
  MonthlyIncomeOverride,
  MonthlyIncomeResult,
} from "../../core/income/income-plan.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";
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

function amount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function ownerOptions(ownerContexts: OwnerContextLabel[], selected?: string) {
  return ownerContexts.map(({ ownerContext, label }) => ({
    value: ownerContext,
    label,
    selected: ownerContext === selected,
  }));
}

function prepareIncomeForm(
  ownerContexts: OwnerContextLabel[],
  plan?: IncomePlan,
  formError?: string,
) {
  const actionUrl = plan === undefined ? "/income" : `/income/${encodeURIComponent(plan.id)}`;
  return {
    heading: plan === undefined ? "Add income" : "Edit income",
    actionUrl,
    submitLabel: plan === undefined ? "Add income" : "Save income",
    name: plan?.name ?? "",
    amount: plan === undefined ? "" : amount(plan.amountCents),
    startMonth: plan?.startMonth ?? "",
    endMonth: plan?.endMonth ?? "",
    activeChecked: plan?.active ?? true,
    ownerContexts: ownerOptions(ownerContexts, plan?.ownerContext),
    formError,
  };
}

const incomeText = {
  name: "Income name",
  ownerContext: "Owner context",
  amount: "Amount",
  startMonth: "Start month",
  endMonth: "End month",
  active: "Active",
  monthPlaceholder: "YYYY-MM",
  overrideHeading: "Monthly override",
  overrideIncome: "Override income",
  overrideMonth: "Override month",
  overrideAmount: "Override amount",
  overrideNote: "Override note",
  saveOverride: "Save override",
  filtersHeading: "Income filters",
  calculationMonth: "Calculation month",
  filterOwner: "Filter owner context",
  applyFilters: "Apply income filters",
  updateCalculation: "Update calculation",
  summaryHeading: "Monthly income summary",
  listHeading: "Income list",
  noPlans: "No income plans found.",
  owner: "Owner",
  start: "Start",
  end: "End",
  actions: "Actions",
  edit: "Edit",
  overridesHeading: "Monthly overrides",
  noOverrides: "No income overrides found.",
  month: "Month",
  income: "Income",
  note: "Note",
} as const;

export function prepareIncomeViewModel(input: IncomeViewInput) {
  const owners = new Map(
    input.ownerContexts.map(({ ownerContext, label }) => [ownerContext, label]),
  );
  const plans = new Map(input.allPlans.map(({ id, name }) => [id, name]));
  return {
    title: "FamilyFlow Income",
    heading: "Income Planning",
    text: incomeText,
    form: prepareIncomeForm(input.ownerContexts, undefined, input.formError),
    planOptions: input.allPlans.map(({ id, name }) => ({ value: id, label: name })),
    filterMonth: input.filters.month,
    ownerContexts: ownerOptions(input.ownerContexts, input.filters.ownerContext).map(
      ({ value, selected }) => ({ value, selected }),
    ),
    ownerContextOptions: [
      { value: "", label: "All owners", selected: input.filters.ownerContext === undefined },
      ...ownerOptions(input.ownerContexts, input.filters.ownerContext),
    ],
    monthlyIncomeLabel: `Monthly planned income: ${amount(input.monthlyIncome.totalCents)}`,
    empty: input.plans.length === 0,
    rows: input.plans.map((plan) => ({
      name: plan.name,
      ownerLabel: owners.get(plan.ownerContext) ?? plan.ownerContext,
      amount: amount(plan.amountCents),
      startMonth: plan.startMonth,
      endMonth: plan.endMonth ?? "",
      editUrl: `/income/${encodeURIComponent(plan.id)}/edit`,
    })),
    overridesEmpty: input.overrides.length === 0,
    overrides: input.overrides.map((override) => ({
      month: override.month,
      incomeName: plans.get(override.incomePlanId) ?? override.incomePlanId,
      amount: amount(override.amountCents),
      note: override.note ?? "",
    })),
  };
}

export function prepareIncomeEditViewModel(input: {
  plan: IncomePlan;
  ownerContexts: OwnerContextLabel[];
  formError?: string;
}) {
  return {
    title: "Edit Income",
    text: incomeText,
    ...prepareIncomeForm(input.ownerContexts, input.plan, input.formError),
    heading: "Edit Income",
  };
}
