import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { OwnerContextRepository } from "../../ports/repositories/owner-context-repository.js";
import type { TransactionRepository } from "../../ports/repositories/transaction-repository.js";
import { isHtmxRequest, readForm, readRouteId } from "./request-values.js";
import { createTransactionFromForm, readTransactionFilters } from "./transaction-request.js";
import { transactionFiltersQuery } from "./transaction-view-model.js";
import { createFamilyFlowViews } from "./views.js";

type TransactionRouteRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
  ownerContexts: OwnerContextRepository;
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

  server.post("/transactions/:id/internal-transfer", async (request, reply) => {
    return handleInternalTransfer(repositories, request, reply);
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
  const [accounts, categories, ownerContexts] = await Promise.all([
    repositories.accounts.listActive(),
    repositories.categories.listActive(),
    repositories.ownerContexts.list(),
  ]);
  const filters = readTransactionFilters(request.query, reply.server.localization);
  const transactions = await repositories.transactions.list(filters);

  const views = createFamilyFlowViews(reply);
  if (isHtmxRequest(request.headers)) {
    return reply
      .type("text/html; charset=utf-8")
      .send(await views.transactionsList({ transactions, categories, filters }));
  }

  return reply.type("text/html; charset=utf-8").send(
    await views.transactionsPage({
      accounts,
      categories,
      ownerContexts,
      transactions,
      filters,
    }),
  );
}

async function handleCreateTransaction(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await repositories.transactions.save(
      createTransactionFromForm(readForm(request.body), randomUUID(), reply.server.localization),
    );
  } catch (error: unknown) {
    const formError = reply.server.localization.errorMessage(error, "transaction.saveFailed");
    const state = await readTransactionsState(repositories, formError);
    const views = createFamilyFlowViews(reply);
    const body = isHtmxRequest(request.headers)
      ? await views.transactionsPanel(state)
      : await views.transactionsPage(state);

    return reply.status(400).type("text/html; charset=utf-8").send(body);
  }

  if (isHtmxRequest(request.headers)) {
    const categories = await repositories.categories.list();

    return reply.type("text/html; charset=utf-8").send(
      await createFamilyFlowViews(reply).transactionsList({
        transactions: await repositories.transactions.list({}),
        categories,
      }),
    );
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
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).missingResourcePage("transaction"));
  }

  const [accounts, categories] = await Promise.all([
    repositories.accounts.listActive(),
    repositories.categories.listActive(),
  ]);

  return reply
    .type("text/html; charset=utf-8")
    .send(
      await createFamilyFlowViews(reply).transactionEditPage({ accounts, categories, transaction }),
    );
}

async function handleUpdateTransaction(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const id = readRouteId(request.params);
  const existing = await repositories.transactions.get(id);
  if (existing === null) {
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).missingResourcePage("transaction"));
  }

  try {
    await repositories.transactions.save(
      createTransactionFromForm(readForm(request.body), id, reply.server.localization, existing),
    );
  } catch (error: unknown) {
    const [accounts, categories] = await Promise.all([
      repositories.accounts.listActive(),
      repositories.categories.listActive(),
    ]);
    const input = {
      accounts,
      categories,
      transaction: existing,
      formError: reply.server.localization.errorMessage(error, "transaction.saveFailed"),
    };
    const views = createFamilyFlowViews(reply);
    const body = isHtmxRequest(request.headers)
      ? await views.transactionEditPanel(input)
      : await views.transactionEditPage(input);
    return reply.status(400).type("text/html; charset=utf-8").send(body);
  }

  if (isHtmxRequest(request.headers)) {
    return reply
      .type("text/html; charset=utf-8")
      .send(await renderTransactionsPanelState(repositories, reply));
  }

  return reply.redirect("/transactions");
}

async function handleInternalTransfer(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const form = readForm(request.body);
  if (form.internalTransfer !== "true" && form.internalTransfer !== "false") {
    const requestId = String(reply.getHeader("x-request-id"));
    return reply
      .status(400)
      .type("text/html; charset=utf-8")
      .send(
        await createFamilyFlowViews(reply).badRequestPage(
          reply.server.localization.text("transaction.invalidTransferStatus"),
          requestId,
        ),
      );
  }

  const updated = await repositories.transactions.setInternalTransfer(
    readRouteId(request.params),
    form.internalTransfer === "true",
  );
  if (!updated) {
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).missingResourcePage("transaction"));
  }

  const filters = readTransactionFilters(request.query, reply.server.localization);
  if (isHtmxRequest(request.headers)) {
    const categories = await repositories.categories.list();
    return reply.type("text/html; charset=utf-8").send(
      await createFamilyFlowViews(reply).transactionsList({
        transactions: await repositories.transactions.list(filters),
        categories,
        filters,
      }),
    );
  }

  return reply.redirect(
    `/transactions${transactionFiltersQuery(filters, reply.server.localization)}`,
  );
}

async function handleDeleteTransaction(
  repositories: TransactionRouteRepositories,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await repositories.transactions.delete(readRouteId(request.params));

  if (isHtmxRequest(request.headers)) {
    const categories = await repositories.categories.list();

    return reply.type("text/html; charset=utf-8").send(
      await createFamilyFlowViews(reply).transactionsList({
        transactions: await repositories.transactions.list({}),
        categories,
      }),
    );
  }

  return reply.redirect("/transactions");
}

async function renderTransactionsPanelState(
  repositories: TransactionRouteRepositories,
  reply: FastifyReply,
  formError?: string,
): Promise<string> {
  return createFamilyFlowViews(reply).transactionsPanel(
    await readTransactionsState(repositories, formError),
  );
}

async function readTransactionsState(
  repositories: TransactionRouteRepositories,
  formError?: string,
) {
  const [accounts, categories, ownerContexts, transactions] = await Promise.all([
    repositories.accounts.listActive(),
    repositories.categories.listActive(),
    repositories.ownerContexts.list(),
    repositories.transactions.list({}),
  ]);

  return { accounts, categories, ownerContexts, transactions, filters: {}, formError };
}
