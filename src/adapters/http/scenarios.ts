import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  assertAdjustmentWithinScenario,
  createHistoricalBaselineSnapshot,
  createScenario,
  createScenarioAdjustment,
  updateScenario,
  type ScenarioBaseline,
} from "../../core/scenarios/scenario.js";
import type { Clock } from "../../ports/clock/clock.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { ScenarioRepository } from "../../ports/repositories/scenario-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import { toLocalCalendarMonth } from "../clock/local-calendar-date.js";
import { isHtmxRequest, readForm } from "./request-values.js";
import { createFamilyFlowViews } from "./views.js";

type Repositories = { scenarios: ScenarioRepository; transactions: TransactionRepository };

export function registerScenarioRoutes(
  server: FastifyInstance,
  repositories: Repositories,
  clock: Clock,
): void {
  server.get("/scenarios", async (request, reply) => render(repositories, request, reply));
  server.post("/scenarios", async (request, reply) => create(repositories, clock, request, reply));
  server.post("/scenarios/:id", async (request, reply) =>
    update(repositories, clock, request, reply),
  );
  server.post("/scenarios/:id/adjustments", async (request, reply) =>
    addAdjustment(repositories, request, reply),
  );
  server.get("/calculators", async (_request, reply) =>
    reply
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).calculatorPage()),
  );
}

async function create(
  repositories: Repositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const form = readForm(request.body);
    const localization = reply.request.localization;
    const startMonth = localization.parseMonth(required(form, "startMonth"));
    const endMonth = localization.parseMonth(required(form, "endMonth"));
    validateRangeFirst(startMonth, endMonth);
    const baseline = await readBaseline(form, repositories, clock, localization);
    const scenario = createScenario({
      id: randomUUID(),
      name: required(form, "name"),
      startMonth,
      endMonth,
      startingBufferCents: localization.parseAmountCents(required(form, "startingBuffer"), true),
      baseIncomeCents: localization.parseAmountCents(required(form, "baseIncome"), true),
      baseline,
    });
    await repositories.scenarios.save(scenario, []);
    return sendState(repositories, request, reply, scenario.id);
  } catch (error: unknown) {
    return formError(repositories, request, reply, error);
  }
}

async function update(
  repositories: Repositories,
  clock: Clock,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const id = routeId(request.params);
  const stored = await repositories.scenarios.get(id);
  if (stored === null) return reply.status(404).send();
  try {
    const form = readForm(request.body);
    const localization = reply.request.localization;
    const startMonth = localization.parseMonth(required(form, "startMonth"));
    const endMonth = localization.parseMonth(required(form, "endMonth"));
    const baseline =
      form.baselineMode === "preserve"
        ? stored.scenario.baseline
        : await readBaseline(form, repositories, clock, localization);
    const scenario = updateScenario(
      stored.scenario,
      {
        name: required(form, "name"),
        startMonth,
        endMonth,
        startingBufferCents: localization.parseAmountCents(required(form, "startingBuffer"), true),
        baseIncomeCents: localization.parseAmountCents(required(form, "baseIncome"), true),
        baseline,
      },
      stored.adjustments,
    );
    await repositories.scenarios.save(scenario, stored.adjustments);
    return sendState(repositories, request, reply, id);
  } catch (error: unknown) {
    return formError(repositories, request, reply, error, id);
  }
}

async function addAdjustment(
  repositories: Repositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const id = routeId(request.params);
  const stored = await repositories.scenarios.get(id);
  if (stored === null) return reply.status(404).send();
  try {
    const form = readForm(request.body);
    const direction = required(form, "direction");
    const magnitude = reply.request.localization.parseAmountCents(required(form, "amount"), true);
    const adjustment = createScenarioAdjustment({
      id: randomUUID(),
      scenarioId: id,
      name: required(form, "name"),
      type: required(form, "type") as "income" | "expense",
      deltaCents: direction === "decrease" ? -magnitude : magnitude,
      startMonth: reply.request.localization.parseMonth(required(form, "startMonth")),
      endMonth: reply.request.localization.parseMonth(required(form, "endMonth")),
    });
    if (direction !== "increase" && direction !== "decrease") throw new Error("Invalid direction");
    assertAdjustmentWithinScenario(stored.scenario, adjustment);
    await repositories.scenarios.save(stored.scenario, [...stored.adjustments, adjustment]);
    return sendState(repositories, request, reply, id);
  } catch (error: unknown) {
    return formError(repositories, request, reply, error, id);
  }
}

async function readBaseline(
  form: ReturnType<typeof readForm>,
  repositories: Repositories,
  clock: Clock,
  l: Localization,
): Promise<ScenarioBaseline> {
  const mode = required(form, "baselineMode");
  if (mode === "manual")
    return {
      mode: "manual",
      expenseCents: l.parseAmountCents(required(form, "manualBaseline"), true),
    };
  const windowText = mode.startsWith("historical-")
    ? mode.slice(11)
    : required(form, "historicalWindow");
  const windowLength = Number(windowText);
  if (windowLength !== 3 && windowLength !== 6 && windowLength !== 12)
    throw new Error("Historical window must be 3, 6, or 12 months");
  return createHistoricalBaselineSnapshot(
    await repositories.transactions.list({}),
    toLocalCalendarMonth(clock.now()),
    windowLength,
  );
}

async function render(
  repositories: Repositories,
  request: FastifyRequest,
  reply: FastifyReply,
  formError?: string,
  selectedId?: string,
) {
  const items = await repositories.scenarios.list();
  const queryId = queryScenarioId(request.query);
  const selected =
    items.find(({ scenario }) => scenario.id === (selectedId ?? queryId)) ?? items.at(-1);
  const input = { items, selected, formError };
  const views = createFamilyFlowViews(reply);
  const body = isHtmxRequest(request.headers)
    ? await views.scenarioPanel(input)
    : await views.scenarioPage(input);
  return reply.type("text/html; charset=utf-8").send(body);
}
async function sendState(
  repositories: Repositories,
  request: FastifyRequest,
  reply: FastifyReply,
  selectedId: string,
) {
  if (isHtmxRequest(request.headers))
    return render(repositories, request, reply, undefined, selectedId);
  return reply.redirect("/scenarios");
}
async function formError(
  repositories: Repositories,
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  selectedId?: string,
) {
  reply.status(400);
  return render(
    repositories,
    request,
    reply,
    reply.request.localization.errorMessage(error, "scenario.saveFailed"),
    selectedId,
  );
}
function validateRangeFirst(startMonth: string, endMonth: string): void {
  createScenario({
    id: "range-validation",
    name: "range-validation",
    startMonth,
    endMonth,
    startingBufferCents: 0,
    baseIncomeCents: 0,
    baseline: { mode: "manual", expenseCents: 0 },
  });
}
function required(form: ReturnType<typeof readForm>, field: string): string {
  const value = form[field]?.trim();
  if (!value) throw new Error(`${field} is required`);
  return value;
}
function routeId(params: unknown): string {
  if (typeof params !== "object" || params === null) return "";
  const id = Reflect.get(params, "id");
  return typeof id === "string" ? id : "";
}
function queryScenarioId(query: unknown): string | undefined {
  if (typeof query !== "object" || query === null) return undefined;
  const id = Reflect.get(query, "id");
  return typeof id === "string" ? id : undefined;
}
