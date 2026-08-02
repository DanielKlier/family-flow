import { parseOwnerContext, type OwnerContext } from "../shared/owner-context.js";

export type IncomePlan = {
  id: string;
  ownerContext: OwnerContext;
  name: string;
  amountCents: number;
  startMonth: string;
  endMonth: string | null;
  active: boolean;
};

export type IncomePlanInput = Omit<IncomePlan, "ownerContext"> & {
  ownerContext: string;
};

export type MonthlyIncomeOverride = {
  id: string;
  incomePlanId: string;
  month: string;
  amountCents: number;
  note: string | null;
};

export type MonthlyIncomeOverrideInput = MonthlyIncomeOverride;

export type MonthlyIncomeFilters = {
  month: string;
  ownerContext?: OwnerContext;
};

export type MonthlyIncomeResult = {
  month: string;
  totalCents: number;
  entries: { incomePlanId: string; name: string; amountCents: number }[];
};

export function createIncomePlan(input: IncomePlanInput): IncomePlan {
  const id = input.id.trim();
  const name = input.name.trim();

  if (id === "") {
    throw new Error("Income plan id is required");
  }
  if (name === "") {
    throw new Error("Income name is required");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Income amount must be positive cents");
  }
  assertMonth(input.startMonth, "Income start month must use YYYY-MM");
  if (input.endMonth !== null) {
    assertMonth(input.endMonth, "Income end month must use YYYY-MM");
    if (input.endMonth < input.startMonth) {
      throw new Error("Income end month must not be before start month");
    }
  }

  return {
    id,
    ownerContext: parseOwnerContext(input.ownerContext),
    name,
    amountCents: input.amountCents,
    startMonth: input.startMonth,
    endMonth: input.endMonth,
    active: input.active,
  };
}

export function createMonthlyIncomeOverride(
  input: MonthlyIncomeOverrideInput,
): MonthlyIncomeOverride {
  const id = input.id.trim();
  const incomePlanId = input.incomePlanId.trim();

  if (id === "") {
    throw new Error("Income override id is required");
  }
  if (incomePlanId === "") {
    throw new Error("Income override plan is required");
  }
  assertMonth(input.month, "Income override month must use YYYY-MM");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new Error("Income override amount must be non-negative cents");
  }

  return {
    id,
    incomePlanId,
    month: input.month,
    amountCents: input.amountCents,
    note: normalizeOptionalText(input.note),
  };
}

export function calculateMonthlyIncome(
  plans: IncomePlan[],
  overrides: MonthlyIncomeOverride[],
  filters: MonthlyIncomeFilters,
): MonthlyIncomeResult {
  assertMonth(filters.month, "Income calculation month must use YYYY-MM");
  const entries = plans
    .filter((plan) => isPlanActiveForMonth(plan, filters.month))
    .filter(
      (plan) => filters.ownerContext === undefined || plan.ownerContext === filters.ownerContext,
    )
    .map((plan) => {
      const override = overrides.find(
        (candidate) => candidate.incomePlanId === plan.id && candidate.month === filters.month,
      );

      return {
        incomePlanId: plan.id,
        name: plan.name,
        amountCents: override?.amountCents ?? plan.amountCents,
      };
    });

  return {
    month: filters.month,
    totalCents: entries.reduce((sum, entry) => sum + entry.amountCents, 0),
    entries,
  };
}

export function parsePositiveIncomeCents(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Income amount must be a positive decimal amount");
  }

  const cents = Math.round(Number(normalized) * 100);
  if (cents <= 0) {
    throw new Error("Income amount must be positive cents");
  }

  return cents;
}

function isPlanActiveForMonth(plan: IncomePlan, month: string): boolean {
  if (!plan.active || plan.startMonth > month) {
    return false;
  }

  return plan.endMonth === null || plan.endMonth >= month;
}

function assertMonth(value: string, message: string): void {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error(message);
  }
}

function normalizeOptionalText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed === "" ? null : trimmed;
}
