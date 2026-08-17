import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  calculateMonthlyIncome,
  createIncomePlan,
  createMonthlyIncomeOverride,
} from "../../core/income/income-plan.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { IncomeRepository } from "../../ports/repositories/income-repository.js";
import type { OwnerContextRepository } from "../../ports/repositories/owner-context-repository.js";
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
): void {
  server.get("/income", async (request, reply) => {
    return handleListIncome(repositories, request, reply);
  });

  server.post("/income", async (request, reply) => {
    return handleCreateIncome(repositories, request, reply);
  });

  server.post("/income/overrides", async (request, reply) => {
    return handleCreateOverride(repositories, request, reply);
  });

  server.get("/income/:id/edit", async (request, reply) => {
    return handleEditIncomeForm(repositories, request, reply);
  });

  server.post("/income/:id", async (request, reply) => {
    return handleUpdateIncome(repositories, request, reply);
  });
}

async function handleListIncome(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const filters = readIncomeFilters(request.query, currentMonth(), reply.server.localization);
  const state = await readIncomePanelState(repositories, filters);

  const views = createFamilyFlowViews(reply);
  if (isHtmxRequest(request.headers)) {
    return reply.type("text/html; charset=utf-8").send(await views.incomePanel(state));
  }

  return reply.type("text/html; charset=utf-8").send(await views.incomePage(state));
}

async function handleCreateIncome(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await repositories.income.savePlan(
      createIncomePlanFromForm(readForm(request.body), randomUUID(), reply.server.localization),
    );
  } catch (error: unknown) {
    return handleFormError(repositories, request, reply, error, "income.saveFailed");
  }

  return sendIncomeState(repositories, request, reply);
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
      createIncomePlanFromForm(readForm(request.body), id, reply.server.localization),
    );
  } catch (error: unknown) {
    const ownerContexts = await repositories.ownerContexts.list();
    const input = {
      plan: existing,
      ownerContexts,
      formError: reply.server.localization.errorMessage(error, "income.saveFailed"),
    };
    const views = createFamilyFlowViews(reply);
    const body = isHtmxRequest(request.headers)
      ? await views.incomeEditPanel(input)
      : await views.incomeEditPage(input);
    return reply.status(400).type("text/html; charset=utf-8").send(body);
  }

  return sendIncomeState(repositories, request, reply);
}

async function handleCreateOverride(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const form = readForm(request.body);

  try {
    await repositories.income.saveOverride(
      createMonthlyIncomeOverride({
        id: randomUUID(),
        incomePlanId: requireFormValue(form, "incomePlanId"),
        month: reply.server.localization.parseMonth(requireFormValue(form, "month")),
        amountCents: reply.server.localization.parseAmountCents(
          requireFormValue(form, "amount"),
          true,
        ),
        note: form.note ?? null,
      }),
    );
  } catch (error: unknown) {
    return handleFormError(repositories, request, reply, error, "income.overrideSaveFailed");
  }

  return sendIncomeState(repositories, request, reply);
}

async function sendIncomeState(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (isHtmxRequest(request.headers)) {
    return reply
      .type("text/html; charset=utf-8")
      .send(
        await createFamilyFlowViews(reply).incomePanel(
          await readIncomePanelState(repositories, { month: currentMonth() }),
        ),
      );
  }

  return reply.redirect("/income");
}

async function handleFormError(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  fallbackKey: string,
) {
  const state = await readIncomePanelState(
    repositories,
    { month: currentMonth() },
    reply.server.localization.errorMessage(error, fallbackKey),
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

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
