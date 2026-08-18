import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  calculateMonthlyIncome,
  createIncomePlan,
  createMonthlyIncomeOverride,
} from "../../core/income/income-plan.js";
import type { Clock } from "../../ports/clock/clock.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { IncomeRepository } from "../../ports/repositories/income-repository.js";
import type { OwnerContextRepository } from "../../ports/repositories/owner-context-repository.js";
import { toLocalCalendarMonth } from "../clock/local-calendar-date.js";
import { readIncomeFilters, requireFormValue } from "./income-request.js";
import { isHtmxRequest, readForm, readRouteId } from "./request-values.js";
import { createFamilyFlowViews } from "./views.js";

type IncomeRouteRepositories = {
  income: IncomeRepository;
  ownerContexts: OwnerContextRepository;
};

export function registerIncomeRoutes(
  server: FastifyInstance,
  repositories: IncomeRouteRepositories,
  clock: Clock,
): void {
  server.get("/income", async (request, reply) => {
    return handleListIncome(repositories, clock, request, reply);
  });

  server.post("/income", async (request, reply) => {
    return handleCreateIncome(repositories, clock, request, reply);
  });

  server.post("/income/overrides", async (request, reply) => {
    return handleCreateOverride(repositories, clock, request, reply);
  });

  server.get("/income/:id/edit", async (request, reply) => {
    return handleEditIncomeForm(repositories, request, reply);
  });

  server.post("/income/:id", async (request, reply) => {
    return handleUpdateIncome(repositories, clock, request, reply);
  });

  server.post("/income/:id/deactivate", async (request, reply) => {
    return handleActivation(repositories, clock, request, reply, false);
  });

  server.post("/income/:id/activate", async (request, reply) => {
    return handleActivation(repositories, clock, request, reply, true);
  });
}

async function handleListIncome(
  repositories: IncomeRouteRepositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const filters = readIncomeFilters(request.query, currentMonth(clock), reply.request.localization);
  const state = await readIncomePanelState(repositories, filters);

  const views = createFamilyFlowViews(reply);
  if (isHtmxRequest(request.headers)) {
    return reply.type("text/html; charset=utf-8").send(await views.incomePanel(state));
  }

  return reply.type("text/html; charset=utf-8").send(await views.incomePage(state));
}

async function handleCreateIncome(
  repositories: IncomeRouteRepositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await repositories.income.savePlan(
      createIncomePlanFromForm(readForm(request.body), randomUUID(), reply.request.localization),
    );
  } catch (error: unknown) {
    return handleFormError(repositories, clock, request, reply, error, "income.saveFailed");
  }

  return sendIncomeState(repositories, clock, request, reply);
}

async function handleEditIncomeForm(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const [plan, ownerContexts] = await Promise.all([
    repositories.income.getPlan(readRouteId(request.params)),
    repositories.ownerContexts.list(),
  ]);
  if (plan === null) {
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).missingResourcePage("incomePlan"));
  }

  return reply
    .type("text/html; charset=utf-8")
    .send(await createFamilyFlowViews(reply).incomeEditPage({ plan, ownerContexts }));
}

async function handleUpdateIncome(
  repositories: IncomeRouteRepositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const id = readRouteId(request.params);
  const existing = await repositories.income.getPlan(id);
  if (existing === null) {
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).missingResourcePage("incomePlan"));
  }

  try {
    await repositories.income.savePlan(
      createIncomePlanFromForm(readForm(request.body), id, reply.request.localization),
    );
  } catch (error: unknown) {
    const ownerContexts = await repositories.ownerContexts.list();
    const input = {
      plan: existing,
      ownerContexts,
      formError: reply.request.localization.errorMessage(error, "income.saveFailed"),
    };
    const views = createFamilyFlowViews(reply);
    const body = isHtmxRequest(request.headers)
      ? await views.incomeEditPanel(input)
      : await views.incomeEditPage(input);
    return reply.status(400).type("text/html; charset=utf-8").send(body);
  }

  return sendIncomeState(repositories, clock, request, reply);
}

async function handleActivation(
  repositories: IncomeRouteRepositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
  active: boolean,
) {
  const plan = await repositories.income.getPlan(readRouteId(request.params));
  if (plan === null) {
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).missingResourcePage("incomePlan"));
  }

  await repositories.income.savePlan({ ...plan, active });
  return sendIncomeState(
    repositories,
    clock,
    request,
    reply,
    readIncomeFilters(request.query, currentMonth(clock), reply.request.localization),
  );
}

async function handleCreateOverride(
  repositories: IncomeRouteRepositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const form = readForm(request.body);

  try {
    await repositories.income.saveOverride(
      createMonthlyIncomeOverride({
        id: randomUUID(),
        incomePlanId: requireFormValue(form, "incomePlanId"),
        month: reply.request.localization.parseMonth(requireFormValue(form, "month")),
        amountCents: reply.request.localization.parseAmountCents(
          requireFormValue(form, "amount"),
          true,
        ),
        note: form.note ?? null,
      }),
    );
  } catch (error: unknown) {
    return handleFormError(repositories, clock, request, reply, error, "income.overrideSaveFailed");
  }

  return sendIncomeState(repositories, clock, request, reply);
}

async function sendIncomeState(
  repositories: IncomeRouteRepositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
  filters = { month: currentMonth(clock) },
) {
  if (isHtmxRequest(request.headers)) {
    return reply
      .type("text/html; charset=utf-8")
      .send(
        await createFamilyFlowViews(reply).incomePanel(
          await readIncomePanelState(repositories, filters),
        ),
      );
  }

  return reply.redirect("/income");
}

async function handleFormError(
  repositories: IncomeRouteRepositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  fallbackKey: string,
) {
  const state = await readIncomePanelState(
    repositories,
    { month: currentMonth(clock) },
    reply.request.localization.errorMessage(error, fallbackKey),
  );
  const views = createFamilyFlowViews(reply);
  const body = isHtmxRequest(request.headers)
    ? await views.incomePanel(state)
    : await views.incomePage(state);

  return reply.status(400).type("text/html; charset=utf-8").send(body);
}

async function readIncomePanelState(
  repositories: IncomeRouteRepositories,
  filters: ReturnType<typeof readIncomeFilters>,
  formError?: string,
) {
  const [plans, allPlans, overrides, ownerContexts] = await Promise.all([
    repositories.income.listPlans(filters),
    repositories.income.listPlans({}),
    repositories.income.listOverrides({ month: filters.month }),
    repositories.ownerContexts.list(),
  ]);
  const monthlyIncome = calculateMonthlyIncome(plans, overrides, filters);

  return { plans, allPlans, overrides, ownerContexts, filters, monthlyIncome, formError };
}

function createIncomePlanFromForm(
  form: ReturnType<typeof readForm>,
  id: string,
  localization: Localization,
) {
  const endMonth = form.endMonth?.trim() === "" ? null : (form.endMonth ?? null);

  return createIncomePlan({
    id,
    ownerContext: requireFormValue(form, "ownerContext"),
    name: requireFormValue(form, "name"),
    amountCents: localization.parseAmountCents(requireFormValue(form, "amount"), false),
    startMonth: localization.parseMonth(requireFormValue(form, "startMonth")),
    endMonth: endMonth === null ? null : localization.parseMonth(endMonth),
    active: form.active !== "off",
  });
}

function currentMonth(clock?: Clock): string {
  return toLocalCalendarMonth(clock?.now() ?? new Date());
}
