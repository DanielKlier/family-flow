import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createCategorizationRule } from "../../core/categorization/categorization-rule.js";
import { reapplyCategorizationRules } from "../../core/categorization/reapply-categorization-rules.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategorizationRuleRepository } from "../../ports/repositories/categorization-rule-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import { type FormBody, readForm, readRouteId } from "./request-values.js";
import { createFamilyFlowViews } from "./views.js";

type CategorizationRuleRouteRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
  categorizationRules: CategorizationRuleRepository;
  transactions: TransactionRepository;
};

export function registerCategorizationRuleRoutes(
  server: FastifyInstance,
  repositories: CategorizationRuleRouteRepositories,
): void {
  server.get("/categorization-rules", async (_request, reply) => {
    return renderRulePage(repositories, reply);
  });

  server.post("/categorization-rules", async (request, reply) => {
    return handleCreateRule(repositories, request, reply);
  });

  server.get("/categorization-rules/:id/edit", async (request, reply) => {
    return handleEditRuleForm(repositories, request, reply);
  });

  server.post("/categorization-rules/:id", async (request, reply) => {
    return handleUpdateRule(repositories, request, reply);
  });

  server.post("/categorization-rules/:id/delete", async (request, reply) => {
    await repositories.categorizationRules.delete(readRouteId(request.params));

    return reply.redirect("/categorization-rules");
  });

  server.post("/categorization-rules/apply", async (_request, reply) => {
    return handleApplyRules(repositories, reply);
  });
}

async function handleCreateRule(
  repositories: CategorizationRuleRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await repositories.categorizationRules.save(createRuleFromForm(readForm(request.body)));
  } catch (error: unknown) {
    return renderRulePage(
      repositories,
      reply.status(400),
      reply.request.localization.errorMessage(error, "rules.saveFailed"),
    );
  }

  return reply.redirect("/categorization-rules");
}

async function handleEditRuleForm(
  repositories: CategorizationRuleRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const rule = await repositories.categorizationRules.get(readRouteId(request.params));
  if (rule === null) {
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).missingResourcePage("categorizationRule"));
  }

  const [accounts, categories] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
  ]);

  return reply.type("text/html; charset=utf-8").send(
    await createFamilyFlowViews(reply).categorizationRuleEditPage({
      accounts,
      categories,
      rules: [],
      rule,
    }),
  );
}

async function handleUpdateRule(
  repositories: CategorizationRuleRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const id = readRouteId(request.params);
  const existing = await repositories.categorizationRules.get(id);
  if (existing === null) {
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).missingResourcePage("categorizationRule"));
  }

  try {
    await repositories.categorizationRules.save(createRuleFromForm(readForm(request.body), id));
  } catch (error: unknown) {
    const [accounts, categories] = await Promise.all([
      repositories.accounts.list(),
      repositories.categories.list(),
    ]);
    return reply
      .status(400)
      .type("text/html; charset=utf-8")
      .send(
        await createFamilyFlowViews(reply).categorizationRuleEditPage({
          accounts,
          categories,
          rules: [],
          rule: existing,
          formError: reply.request.localization.errorMessage(error, "rules.saveFailed"),
        }),
      );
  }

  return reply.redirect("/categorization-rules");
}

async function handleApplyRules(
  repositories: CategorizationRuleRouteRepositories,
  reply: FastifyReply,
) {
  const rules = await repositories.categorizationRules.list();
  const applicationResult = await reapplyCategorizationRules(rules, repositories.transactions);

  return renderRulePage(repositories, reply, undefined, applicationResult);
}

async function renderRulePage(
  repositories: CategorizationRuleRouteRepositories,
  reply: FastifyReply,
  formError?: string,
  applicationResult?: { changed: number; unchanged: number },
) {
  const [accounts, categories, rules] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
    repositories.categorizationRules.list(),
  ]);

  return reply.type("text/html; charset=utf-8").send(
    await createFamilyFlowViews(reply).categorizationRulesPage({
      accounts,
      categories,
      rules,
      formError,
      applicationResult,
    }),
  );
}

function createRuleFromForm(form: FormBody, id: string = randomUUID()) {
  return createCategorizationRule({
    id,
    name: form.name ?? "",
    searchText: form.searchText ?? "",
    categoryId: form.categoryId ?? "",
    accountId: form.accountId ?? null,
    fixedCost: readFixedCostAction(form.fixedCost),
    internalTransfer: readInternalTransferAction(form.internalTransfer),
    priority: Number(form.priority ?? ""),
    enabled: true,
  });
}

function readInternalTransferAction(value: string | undefined): boolean | null {
  if (value === undefined || value === "unchanged") return null;
  if (value === "mark") return true;
  if (value === "unmark") return false;
  throw new Error("Internal transfer action is invalid");
}

function readFixedCostAction(value: string | undefined): boolean | null {
  if (value === "fixed") {
    return true;
  }
  if (value === "variable") {
    return false;
  }

  return null;
}
