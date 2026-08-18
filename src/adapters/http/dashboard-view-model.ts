import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { DashboardResult } from "../../core/dashboard/dashboard.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { DashboardQuery } from "./dashboard-request.js";

export type DashboardViewInput = {
  dashboard: DashboardResult;
  filters: DashboardQuery;
  accounts: Account[];
  categories: Category[];
  ownerContexts: OwnerContextLabel[];
  user: UserContext;
};

export function prepareDashboardViewModel(input: DashboardViewInput, localization: Localization) {
  const option = (value: string, label: string, selected?: string) => ({
    value,
    label,
    selected: value === selected,
  });
  const owners = new Map(
    input.ownerContexts.map(({ ownerContext, label }) => [ownerContext, label]),
  );
  const format = (value: number) => localization.formatAmount(value);
  return {
    title: localization.text("dashboard.title"),
    heading: localization.text("dashboard.heading"),
    session: {
      label: `${localization.text("auth.signedIn")} ${input.user.displayName}`,
      logoutAction: "/auth/logout",
      logoutLabel: localization.text("auth.logout"),
    },
    text: {
      filters: localization.text("dashboard.filters"),
      month: localization.text("common.month"),
      owner: localization.text("common.owner"),
      account: localization.text("common.account"),
      category: localization.text("common.category"),
      apply: localization.text("dashboard.apply"),
      income: localization.text("dashboard.income"),
      expenses: localization.text("dashboard.expenses"),
      balance: localization.text("dashboard.balance"),
      averages: localization.text("dashboard.averages"),
      categoryBreakdown: localization.text("dashboard.byCategory"),
      accountBreakdown: localization.text("dashboard.byAccount"),
      forecast: localization.text("dashboard.forecast"),
      noForecast: localization.text("dashboard.noForecast"),
      bookedFixed: localization.text("dashboard.bookedFixed"),
      plannedFixed: localization.text("dashboard.plannedFixed"),
      variable: localization.text("dashboard.variableForecast"),
      total: localization.text("dashboard.forecastTotal"),
    },
    filterMonth: localization.formatMonth(input.filters.month),
    monthPlaceholder: localization.text("transaction.monthPlaceholder"),
    ownerOptions: [
      option("", localization.text("common.allOwners"), input.filters.ownerContext),
      ...input.ownerContexts.map(({ ownerContext, label }) =>
        option(ownerContext, label, input.filters.ownerContext),
      ),
    ],
    accountOptions: [
      option("", localization.text("common.allAccounts"), input.filters.accountId),
      ...input.accounts.map(({ id, name }) => option(id, name, input.filters.accountId)),
    ],
    categoryOptions: [
      option("", localization.text("common.allCategories"), input.filters.categoryId),
      ...input.categories.map(({ id, name }) => option(id, name, input.filters.categoryId)),
    ],
    metrics: {
      income: format(input.dashboard.incomeCents),
      expenses: format(input.dashboard.expenseCents),
      balance: format(input.dashboard.balanceCents),
    },
    averages: input.dashboard.averages.map(
      ({ months, amountCents }) => `${months}: ${format(amountCents)}`,
    ),
    byCategory: input.dashboard.byCategory.map(
      ({ name, amountCents }) => `${name}: ${format(amountCents)}`,
    ),
    byAccount: input.dashboard.byAccount.map(
      ({ name, ownerContext, amountCents }) =>
        `${name} (${owners.get(ownerContext) ?? ownerContext}): ${format(amountCents)}`,
    ),
    forecast:
      input.dashboard.forecast === null
        ? null
        : {
            bookedFixed: format(input.dashboard.forecast.bookedFixedCents),
            plannedFixed: format(input.dashboard.forecast.openPlannedFixedCents),
            variable: format(input.dashboard.forecast.extrapolatedBookedVariableCents),
            total: format(input.dashboard.forecast.totalCents),
          },
  };
}
