import { parseOwnerContext } from "../../core/shared/owner-context.js";
import type { IncomePlanFilters } from "../../ports/repositories/income-repository.js";
import type { FormBody } from "./request-values.js";
import { readOptionalQueryValue } from "./request-values.js";

export type IncomePageFilters = IncomePlanFilters & {
  month: string;
};

export function readIncomeFilters(query: unknown, defaultMonth: string): IncomePageFilters {
  if (typeof query !== "object" || query === null) {
    return { month: defaultMonth };
  }

  const filters: IncomePageFilters = { month: defaultMonth };
  const month = readOptionalQueryValue(query, "month");
  if (month !== undefined && /^\d{4}-\d{2}$/.test(month)) {
    filters.month = month;
  }
  const ownerContext = readOptionalQueryValue(query, "ownerContext");
  if (ownerContext !== undefined) {
    filters.ownerContext = parseOwnerContext(ownerContext);
  }

  return filters;
}

export function requireFormValue(form: FormBody, name: string): string {
  const value = form[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}
