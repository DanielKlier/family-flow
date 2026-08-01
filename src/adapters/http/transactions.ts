import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import { isHtmxRequest, readForm, readRouteId } from "./request-values.js";
import { createTransactionFromForm, readTransactionFilters } from "./transaction-request.js";
import {
  renderTransactionEditPage,
  renderTransactionListSection,
  renderTransactionsPage,
  renderTransactionsPanel,
} from "./templates/transactions.js";

type TransactionRouteRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
  transactions: TransactionRepository;
};

export function registerTransactionRoutes(
  server: FastifyInstance,
  repositories: TransactionRouteRepositories,
): void {
  server.get("/transactions", async (request, reply) => {
    return handleListTransactions(repositories, request, reply);
  });

  server.post("/transactions", async (request, reply) => {
    return handleCreateTransaction(repositories, request, reply);
  });

  server.get("/transactions/:id/edit", async (request, reply) => {
    return handleEditTransactionForm(repositories, request, reply);
  });

  server.post("/transactions/:id", async (request, reply) => {
    return handleUpdateTransaction(repositories, request, reply);
  });

  server.post("/transactions/:id/delete", async (request, reply) => {
    return handleDeleteTransaction(repositories, request, reply);
  });
}

async function handleListTransactions(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const [accounts, categories] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
  ]);
  const filters = readTransactionFilters(request.query);
  const transactions = await repositories.transactions.list(filters);

  if (isHtmxRequest(request.headers)) {
    return reply
      .type("text/html; charset=utf-8")
      .send(renderTransactionListSection(transactions, categories));
  }

  return reply
    .type("text/html; charset=utf-8")
    .send(renderTransactionsPage({ accounts, categories, transactions, filters }));
}

async function handleCreateTransaction(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await repositories.transactions.save(
      createTransactionFromForm(readForm(request.body), randomUUID()),
    );
  } catch (error: unknown) {
    if (isHtmxRequest(request.headers)) {
      return reply
        .status(400)
        .type("text/html; charset=utf-8")
        .send(
          await renderTransactionsPanelState(
            repositories,
            error instanceof Error ? error.message : "Transaction could not be saved",
          ),
        );
    }

    throw error;
  }

  if (isHtmxRequest(request.headers)) {
    const categories = await repositories.categories.list();

    return reply
      .type("text/html; charset=utf-8")
      .send(renderTransactionListSection(await repositories.transactions.list({}), categories));
  }

  return reply.redirect("/transactions");
}

async function handleEditTransactionForm(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const transaction = await repositories.transactions.get(readRouteId(request.params));
  if (transaction === null) {
    return reply.status(404).send("Transaction not found");
  }

  const [accounts, categories] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
  ]);

  return reply
    .type("text/html; charset=utf-8")
    .send(renderTransactionEditPage({ accounts, categories, transaction }));
}

async function handleUpdateTransaction(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const id = readRouteId(request.params);
  const existing = await repositories.transactions.get(id);
  if (existing === null) {
    return reply.status(404).send("Transaction not found");
  }

  await repositories.transactions.save(createTransactionFromForm(readForm(request.body), id));

  if (isHtmxRequest(request.headers)) {
    return reply
      .type("text/html; charset=utf-8")
      .send(await renderTransactionsPanelState(repositories));
  }

  return reply.redirect("/transactions");
}

async function handleDeleteTransaction(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await repositories.transactions.delete(readRouteId(request.params));

  if (isHtmxRequest(request.headers)) {
    const categories = await repositories.categories.list();

    return reply
      .type("text/html; charset=utf-8")
      .send(renderTransactionListSection(await repositories.transactions.list({}), categories));
  }

  return reply.redirect("/transactions");
}

async function renderTransactionsPanelState(
  repositories: TransactionRouteRepositories,
  formError?: string,
): Promise<string> {
  const [accounts, categories, transactions] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
    repositories.transactions.list({}),
  ]);

  return renderTransactionsPanel({
    accounts,
    categories,
    transactions,
    filters: {},
    formError,
  });
}
