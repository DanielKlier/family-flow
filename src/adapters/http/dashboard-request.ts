import type { DashboardFilters } from "../../core/dashboard/dashboard.js";
import { parseOwnerContext } from "../../core/shared/owner-context.js";
import type { Localization } from "../../ports/localization/localization.js";
import { readOptionalQueryValue } from "./request-values.js";

export type DashboardQuery = DashboardFilters & { month: string };

export class DashboardQueryValidationError extends Error {
  constructor(readonly cause: unknown) {
    super("Invalid dashboard query", { cause });
    this.name = "DashboardQueryValidationError";
  }
}

export function readDashboardQuery(
  query: unknown,
  defaultMonth: string,
  localization: Localization,
): DashboardQuery {
  if (typeof query !== "object" || query === null) return { month: defaultMonth };
  try {
    const monthValue = readOptionalQueryValue(query, "month");
    const result: DashboardQuery = {
      month: monthValue === undefined ? defaultMonth : localization.parseMonth(monthValue),
    };
    const ownerContext = readOptionalQueryValue(query, "ownerContext");
    const accountId = readOptionalQueryValue(query, "accountId");
    const categoryId = readOptionalQueryValue(query, "categoryId");
    if (ownerContext !== undefined) result.ownerContext = parseOwnerContext(ownerContext);
    if (accountId !== undefined) result.accountId = accountId;
    if (categoryId !== undefined) result.categoryId = categoryId;
    return result;
  } catch (error: unknown) {
    throw new DashboardQueryValidationError(error);
  }
}
