import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { parseOwnerContext } from "../../core/shared/owner-context.js";
import { createTransaction, type Transaction } from "../../core/transactions/transaction.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type {
  TransactionFilters,
  TransactionRepository,
} from "../../ports/repositories/transaction-repository.js";
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

type FormBody = Record<string, string | undefined>;

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
    return reply.type("text/html; charset=utf-8").send(renderTransactionListSection(transactions));
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
    return reply
      .type("text/html; charset=utf-8")
      .send(renderTransactionListSection(await repositories.transactions.list({})));
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
    return reply
      .type("text/html; charset=utf-8")
      .send(renderTransactionListSection(await repositories.transactions.list({})));
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

function readTransactionFilters(query: unknown): TransactionFilters {
  if (typeof query !== "object" || query === null) {
    return {};
  }

  const filters: TransactionFilters = {};
  const month = readOptionalQueryValue(query, "month");
  if (month !== undefined && /^\d{4}-\d{2}$/.test(month)) {
    filters.month = month;
  }
  const accountId = readOptionalQueryValue(query, "accountId");
  if (accountId !== undefined) {
    filters.accountId = accountId;
  }
  const categoryId = readOptionalQueryValue(query, "categoryId");
  if (categoryId !== undefined) {
    filters.categoryId = categoryId;
  }
  const status = readOptionalQueryValue(query, "status");
  if (status === "booked" || status === "planned") {
    filters.status = status;
  }
  const ownerContext = readOptionalQueryValue(query, "ownerContext");
  if (ownerContext !== undefined) {
    filters.ownerContext = parseOwnerContext(ownerContext);
  }

  return filters;
}

function readOptionalQueryValue(query: object, key: string): string | undefined {
  const value = Object.entries(query).find(([candidate]) => candidate === key)?.[1];

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readForm(body: unknown): FormBody {
  if (typeof body !== "object" || body === null) {
    return {};
  }

  const form: FormBody = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" || value === undefined) {
      form[key] = value;
    }
  }

  return form;
}

function createTransactionFromForm(form: FormBody, id: string): Transaction {
  return createTransaction({
    id,
    accountId: requireFormValue(form, "accountId"),
    categoryId: requireFormValue(form, "categoryId"),
    date: requireFormValue(form, "date"),
    amountCents: -parseAmountCents(requireFormValue(form, "amount")),
    description: requireFormValue(form, "description"),
    payee: form.payee ?? null,
    source: "manual",
    status: form.status === "planned" ? "planned" : "booked",
    fixedCost: form.fixedCost === "on",
    note: form.note ?? null,
  });
}

function requireFormValue(form: FormBody, name: string): string {
  const value = form[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}

function parseAmountCents(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Amount must be a positive decimal expense");
  }

  return Math.round(Number(normalized) * 100);
}

function readRouteId(params: unknown): string {
  if (typeof params !== "object" || params === null || !("id" in params)) {
    throw new Error("Route id is required");
  }

  const { id } = params;
  if (typeof id !== "string") {
    throw new Error("Route id is required");
  }

  return id;
}

function isHtmxRequest(headers: Record<string, string | string[] | undefined>): boolean {
  return headers["hx-request"] === "true";
}
