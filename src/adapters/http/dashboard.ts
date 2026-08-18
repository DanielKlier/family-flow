import type { FastifyInstance, FastifyReply } from "fastify";
import { calculateDashboard } from "../../core/dashboard/dashboard.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import type { Clock } from "../../ports/clock/clock.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { IncomeRepository } from "../../ports/repositories/income-repository.js";
import type { OwnerContextRepository } from "../../ports/repositories/owner-context-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import { toLocalCalendarDate } from "../clock/local-calendar-date.js";
import {
  type DashboardQuery,
  DashboardQueryValidationError,
  readDashboardQuery,
} from "./dashboard-request.js";
import { isHtmxRequest } from "./request-values.js";
import { createFamilyFlowViews } from "./views.js";

type DashboardRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
  income: IncomeRepository;
  ownerContexts: OwnerContextRepository;
  transactions: TransactionRepository;
};

export function registerDashboardRoutes(
  server: FastifyInstance,
  repositories: DashboardRepositories,
  clock: Clock,
): void {
  server.get("/", async (request, reply) => {
    const user = readUserContext(request);
    if (user === null) {
      throw new Error("Authenticated dashboard user context is missing");
    }
    const currentDate = toLocalCalendarDate(clock.now());
    const currentMonth = currentDate.slice(0, 7);
    let filters: DashboardQuery;
    try {
      filters = readDashboardQuery(request.query, currentMonth, reply.request.localization);
    } catch (error: unknown) {
      if (!(error instanceof DashboardQueryValidationError)) throw error;
      return badDashboardRequest(
        reply,
        reply.request.localization.errorMessage(error.cause, "error.requestFailed"),
      );
    }
    if (filters.month > currentMonth) {
      return badDashboardRequest(reply, reply.request.localization.text("dashboard.futureMonth"));
    }

    const [accounts, categories, ownerContexts, transactions, incomePlans, incomeOverrides] =
      await Promise.all([
        repositories.accounts.list(),
        repositories.categories.list(),
        repositories.ownerContexts.list(),
        repositories.transactions.list({}),
        repositories.income.listPlans({}),
        repositories.income.listOverrides({}),
      ]);
    const input = {
      dashboard: calculateDashboard({
        selectedMonth: filters.month,
        currentMonth,
        currentDate,
        accounts,
        categories,
        transactions,
        incomePlans,
        incomeOverrides,
        filters,
      }),
      filters,
      accounts,
      categories,
      ownerContexts,
      user,
    };
    const views = createFamilyFlowViews(reply);
    const body = isHtmxRequest(request.headers)
      ? await views.dashboardPanel(input)
      : await views.dashboardPage(input);
    return reply.type("text/html; charset=utf-8").send(body);
  });
}

async function badDashboardRequest(reply: FastifyReply, message: string) {
  const requestId = String(reply.getHeader("x-request-id"));
  return reply
    .status(400)
    .type("text/html; charset=utf-8")
    .send(await createFamilyFlowViews(reply).badRequestPage(message, requestId));
}

function readUserContext(request: object): UserContext | null {
  const candidate = Reflect.get(request, "userContext");
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    typeof Reflect.get(candidate, "id") !== "string" ||
    typeof Reflect.get(candidate, "displayName") !== "string"
  ) {
    return null;
  }
  return {
    id: Reflect.get(candidate, "id"),
    displayName: Reflect.get(candidate, "displayName"),
    email:
      typeof Reflect.get(candidate, "email") === "string" ? Reflect.get(candidate, "email") : null,
  };
}
