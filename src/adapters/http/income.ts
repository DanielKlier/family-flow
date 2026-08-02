import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  calculateMonthlyIncome,
  createIncomePlan,
  createMonthlyIncomeOverride,
  parsePositiveIncomeCents,
} from "../../core/income/income-plan.js";
import type { IncomeRepository } from "../../ports/repositories/income-repository.js";
import type { OwnerContextRepository } from "../../ports/repositories/owner-context-repository.js";
import { isHtmxRequest, readForm, readRouteId } from "./request-values.js";
import { readIncomeFilters, requireFormValue } from "./income-request.js";
import { renderIncomeEditPage, renderIncomePage, renderIncomePanel } from "./templates/income.js";

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
  const filters = readIncomeFilters(request.query, currentMonth());
  const state = await readIncomePanelState(repositories, filters);

  if (isHtmxRequest(request.headers)) {
    return reply.type("text/html; charset=utf-8").send(renderIncomePanel(state));
  }

  return reply.type("text/html; charset=utf-8").send(renderIncomePage(state));
}

async function handleCreateIncome(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await repositories.income.savePlan(
      createIncomePlanFromForm(readForm(request.body), randomUUID()),
    );
  } catch (error: unknown) {
    return handleFormError(repositories, request, reply, error, "Income could not be saved");
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
    return reply.status(404).send("Income plan not found");
  }

  return reply.type("text/html; charset=utf-8").send(renderIncomeEditPage({ plan, ownerContexts }));
}

async function handleUpdateIncome(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const id = readRouteId(request.params);
  const existing = await repositories.income.getPlan(id);
  if (existing === null) {
    return reply.status(404).send("Income plan not found");
  }

  await repositories.income.savePlan(createIncomePlanFromForm(readForm(request.body), id));

  return reply.redirect("/income");
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
        month: requireFormValue(form, "month"),
        amountCents: parsePositiveIncomeCents(requireFormValue(form, "amount")),
        note: form.note ?? null,
      }),
    );
  } catch (error: unknown) {
    return handleFormError(repositories, request, reply, error, "Override could not be saved");
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
      .send(renderIncomePanel(await readIncomePanelState(repositories, { month: currentMonth() })));
  }

  return reply.redirect("/income");
}

async function handleFormError(
  repositories: IncomeRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  fallback: string,
) {
  if (!isHtmxRequest(request.headers)) {
    throw error;
  }

  return reply
    .status(400)
    .type("text/html; charset=utf-8")
    .send(
      renderIncomePanel(
        await readIncomePanelState(
          repositories,
          { month: currentMonth() },
          errorMessage(error, fallback),
        ),
      ),
    );
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

function createIncomePlanFromForm(form: ReturnType<typeof readForm>, id: string) {
  const endMonth = form.endMonth?.trim() === "" ? null : (form.endMonth ?? null);

  return createIncomePlan({
    id,
    ownerContext: requireFormValue(form, "ownerContext"),
    name: requireFormValue(form, "name"),
    amountCents: parsePositiveIncomeCents(requireFormValue(form, "amount")),
    startMonth: requireFormValue(form, "startMonth"),
    endMonth,
    active: form.active !== "off",
  });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
