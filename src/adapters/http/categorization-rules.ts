import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  applyCategorizationRules,
  createCategorizationRule,
} from "../../core/categorization/categorization-rule.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { CategorizationRuleRepository } from "../../ports/repositories/categorization-rule-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import { readForm, readRouteId, type FormBody } from "./request-values.js";
import {
  renderCategorizationRuleEditPage,
  renderCategorizationRulesPage,
} from "./templates/categorization-rules.js";

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
      error instanceof Error ? error.message : "Categorization rule could not be saved",
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
    return reply.status(404).send("Categorization rule not found");
  }

  const [accounts, categories] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
  ]);

  return reply
    .type("text/html; charset=utf-8")
    .send(renderCategorizationRuleEditPage({ accounts, categories, rule }));
}

async function handleUpdateRule(
  repositories: CategorizationRuleRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const id = readRouteId(request.params);
  const existing = await repositories.categorizationRules.get(id);
  if (existing === null) {
    return reply.status(404).send("Categorization rule not found");
  }

  await repositories.categorizationRules.save(createRuleFromForm(readForm(request.body), id));

  return reply.redirect("/categorization-rules");
}

async function handleApplyRules(
  repositories: CategorizationRuleRouteRepositories,
  reply: FastifyReply,
) {
  const [rules, transactions] = await Promise.all([
    repositories.categorizationRules.list(),
    repositories.transactions.list({}),
  ]);
  const updatedTransactions = applyCategorizationRules(rules, transactions);

  await Promise.all(
    updatedTransactions
      .filter(
        (transaction, index) =>
          transaction.categoryId !== transactions[index]?.categoryId ||
          transaction.fixedCost !== transactions[index]?.fixedCost,
      )
      .map((transaction) => repositories.transactions.save(transaction)),
  );

  return reply.redirect("/categorization-rules");
}

async function renderRulePage(
  repositories: CategorizationRuleRouteRepositories,
  reply: FastifyReply,
  formError?: string,
) {
  const [accounts, categories, rules] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
    repositories.categorizationRules.list(),
  ]);

  return reply
    .type("text/html; charset=utf-8")
    .send(renderCategorizationRulesPage({ accounts, categories, rules, formError }));
}

function createRuleFromForm(form: FormBody, id: string = randomUUID()) {
  return createCategorizationRule({
    id,
    name: form.name ?? "",
    searchText: form.searchText ?? "",
    categoryId: form.categoryId ?? "",
    accountId: form.accountId ?? null,
    fixedCost: readFixedCostAction(form.fixedCost),
    priority: Number(form.priority ?? ""),
    enabled: true,
  });
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
