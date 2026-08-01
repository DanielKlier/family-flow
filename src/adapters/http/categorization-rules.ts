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
import { readForm, type FormBody } from "./request-values.js";
import { renderCategorizationRulesPage } from "./templates/categorization-rules.js";

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
      .filter((transaction, index) => transaction.categoryId !== transactions[index]?.categoryId)
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

function createRuleFromForm(form: FormBody) {
  return createCategorizationRule({
    id: randomUUID(),
    name: form.name ?? "",
    searchText: form.searchText ?? "",
    categoryId: form.categoryId ?? "",
    accountId: form.accountId ?? null,
    priority: Number(form.priority ?? ""),
    enabled: true,
  });
}
