import type { Account } from "../accounts/account.js";
import type { Category } from "../categories/category.js";
import {
  calculateMonthlyIncome,
  type IncomePlan,
  type MonthlyIncomeOverride,
} from "../income/income-plan.js";
import type { OwnerContext } from "../shared/owner-context.js";
import type { Transaction } from "../transactions/transaction.js";
import {
  calculateMonthlyForecast,
  type MonthlyForecast,
  roundHalfUp,
} from "../forecasting/monthly-forecast.js";

export type DashboardFilters = {
  ownerContext?: OwnerContext;
  accountId?: string;
  categoryId?: string;
};

export type DashboardResult = {
  month: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  byCategory: { id: string; name: string; amountCents: number }[];
  byAccount: { id: string; name: string; ownerContext: OwnerContext; amountCents: number }[];
  averages: { months: 3 | 6 | 12; amountCents: number }[];
  forecast: MonthlyForecast | null;
};

type DashboardInput = {
  selectedMonth: string;
  currentMonth: string;
  currentDate: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  incomePlans: IncomePlan[];
  incomeOverrides: MonthlyIncomeOverride[];
  filters: DashboardFilters;
};

export function calculateDashboard(input: DashboardInput): DashboardResult {
  if (input.selectedMonth > input.currentMonth)
    throw new Error("Future dashboard months are not allowed");
  const accounts = new Map(input.accounts.map((account) => [account.id, account]));
  const filtered = input.transactions.filter((transaction) =>
    matchesExpenseFilters(transaction, input.filters, accounts),
  );
  const actual = filtered.filter(
    (transaction) =>
      transaction.status === "booked" &&
      transaction.date.startsWith(`${input.selectedMonth}-`) &&
      !transaction.internalTransfer,
  );
  const expenseCents = magnitudeTotal(actual, "Dashboard expense total must be a safe integer");
  const incomeCents = calculateMonthlyIncome(input.incomePlans, input.incomeOverrides, {
    month: input.selectedMonth,
    ownerContext: input.filters.ownerContext,
  }).totalCents;
  const balanceCents = incomeCents - expenseCents;
  if (!Number.isSafeInteger(balanceCents))
    throw new Error("Dashboard balance must be a safe integer");

  return {
    month: input.selectedMonth,
    incomeCents,
    expenseCents,
    balanceCents,
    byCategory: groupCategories(actual, input.categories),
    byAccount: groupAccounts(actual, input.accounts),
    averages: ([3, 6, 12] as const).map((months) => ({
      months,
      amountCents: calculateHistoricalAverage(filtered, input.selectedMonth, months),
    })),
    forecast:
      input.selectedMonth === input.currentMonth
        ? calculateMonthlyForecast(filtered, {
            month: input.selectedMonth,
            currentDate: input.currentDate,
          })
        : null,
  };
}

export function calculateHistoricalAverage(
  transactions: Transaction[],
  selectedMonth: string,
  windowLength: 3 | 6 | 12,
): number {
  const months = precedingMonths(selectedMonth, windowLength);
  const total = magnitudeTotal(
    transactions.filter(
      (transaction) =>
        transaction.status === "booked" &&
        !transaction.internalTransfer &&
        months.has(transaction.date.slice(0, 7)),
    ),
    "Historical expense total must be a safe integer",
  );
  return roundHalfUp(total, windowLength);
}

function matchesExpenseFilters(
  transaction: Transaction,
  filters: DashboardFilters,
  accounts: Map<string, Account>,
): boolean {
  if (filters.accountId !== undefined && transaction.accountId !== filters.accountId) return false;
  if (filters.categoryId !== undefined && transaction.categoryId !== filters.categoryId)
    return false;
  return (
    filters.ownerContext === undefined ||
    accounts.get(transaction.accountId)?.ownerContext === filters.ownerContext
  );
}

function groupCategories(transactions: Transaction[], categories: Category[]) {
  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      amountCents: magnitudeTotal(
        transactions.filter((transaction) => transaction.categoryId === category.id),
        "Category expense total must be a safe integer",
      ),
    }))
    .filter(({ amountCents }) => amountCents > 0);
}

function groupAccounts(transactions: Transaction[], accounts: Account[]) {
  return accounts
    .map((account) => ({
      id: account.id,
      name: account.name,
      ownerContext: account.ownerContext,
      amountCents: magnitudeTotal(
        transactions.filter((transaction) => transaction.accountId === account.id),
        "Account expense total must be a safe integer",
      ),
    }))
    .filter(({ amountCents }) => amountCents > 0);
}

function magnitudeTotal(transactions: Transaction[], message: string): number {
  return transactions.reduce((total, transaction) => {
    const next = total - transaction.amountCents;
    if (!Number.isSafeInteger(next)) throw new Error(message);
    return next;
  }, 0);
}

function precedingMonths(selectedMonth: string, count: number): Set<string> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) throw new Error("Month must use YYYY-MM");
  const [year, month] = selectedMonth.split("-").map(Number);
  const result = new Set<string>();
  for (let offset = 1; offset <= count; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    result.add(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}
