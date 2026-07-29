import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import { createSeededInMemoryRepositories } from "../adapters/db/default-repositories.js";
import { DrizzleAccountRepository } from "../adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../adapters/db/drizzle-category-repository.js";
import { DrizzleTransactionRepository } from "../adapters/db/drizzle-transaction-repository.js";
import { migrate } from "../adapters/db/migrate.js";
import { createPostgresConnection } from "../adapters/db/postgres.js";
import { seedMasterData, type MasterDataRepositories } from "../adapters/db/seeds/master-data.js";
import { registerAuth, type AuthRuntimeConfig } from "../adapters/http/auth.js";
import { registerRequestLifecycle } from "../adapters/http/request-lifecycle.js";
import { HumanReadableRequestLogger } from "../adapters/logging/human-readable-logger.js";
import { parseOwnerContext, type OwnerContext } from "../core/shared/owner-context.js";
import { createTransaction, type Transaction } from "../core/transactions/transaction.js";
import type { RequestLogger } from "../ports/logging/logger.js";
import type {
  TransactionFilters,
  TransactionRepository,
} from "../ports/repositories/transaction-repository.js";
import { loadConfig } from "./config.js";

type AppRepositories = MasterDataRepositories & {
  transactions: TransactionRepository;
};

type ServerOptions = {
  logger?: RequestLogger;
  repositories?: AppRepositories;
  auth?: AuthRuntimeConfig;
};

export function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: false,
  });
  const logger = options.logger ?? new HumanReadableRequestLogger();
  const repositories = options.repositories ?? createSeededInMemoryRepositories();
  const auth =
    options.auth ??
    ({
      mode: "test",
      sessionSecret: "test-session-secret-with-enough-length",
      baseUrl: "http://127.0.0.1:3000",
      oidc: null,
    } satisfies AuthRuntimeConfig);

  registerFormParser(server);
  registerRequestLifecycle(server, logger);
  registerAuth(server, auth);

  server.get("/health", async () => ({ status: "ok" }));
  server.get("/admin/master-data", async (_request, reply) => {
    const [accounts, categories] = await Promise.all([
      repositories.accounts.list(),
      repositories.categories.list(),
    ]);

    return reply.type("text/html; charset=utf-8").send(renderMasterDataPage(accounts, categories));
  });
  server.get("/transactions", async (request, reply) => {
    const [accounts, categories] = await Promise.all([
      repositories.accounts.list(),
      repositories.categories.list(),
    ]);
    const filters = readTransactionFilters(request.query);
    const transactions = await repositories.transactions.list(filters);

    return reply
      .type("text/html; charset=utf-8")
      .send(renderTransactionsPage({ accounts, categories, transactions, filters }));
  });
  server.post("/transactions", async (request, reply) => {
    const form = readForm(request.body);
    const transaction = createTransactionFromForm(form, randomUUID());
    await repositories.transactions.save(transaction);

    return reply.redirect("/transactions");
  });
  server.get("/transactions/:id/edit", async (request, reply) => {
    const id = readRouteId(request.params);
    const transaction = await repositories.transactions.get(id);
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
  });
  server.post("/transactions/:id", async (request, reply) => {
    const id = readRouteId(request.params);
    const existing = await repositories.transactions.get(id);
    if (existing === null) {
      return reply.status(404).send("Transaction not found");
    }

    await repositories.transactions.save(createTransactionFromForm(readForm(request.body), id));

    return reply.redirect("/transactions");
  });
  server.post("/transactions/:id/delete", async (request, reply) => {
    await repositories.transactions.delete(readRouteId(request.params));

    return reply.redirect("/transactions");
  });

  return server;
}

type RenderableAccount = Awaited<ReturnType<MasterDataRepositories["accounts"]["list"]>>[number];
type RenderableCategory = Awaited<ReturnType<MasterDataRepositories["categories"]["list"]>>[number];

type FormBody = Record<string, string | undefined>;

function registerFormParser(server: FastifyInstance): void {
  server.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body.toString())));
    },
  );
}

function readTransactionFilters(query: unknown): TransactionFilters {
  if (typeof query !== "object" || query === null) {
    return {};
  }

  const values = query as Record<string, unknown>;
  const filters: TransactionFilters = {};
  const month = readOptionalQueryValue(values.month);
  if (month !== undefined && /^\d{4}-\d{2}$/.test(month)) {
    filters.month = month;
  }
  const accountId = readOptionalQueryValue(values.accountId);
  if (accountId !== undefined) {
    filters.accountId = accountId;
  }
  const categoryId = readOptionalQueryValue(values.categoryId);
  if (categoryId !== undefined) {
    filters.categoryId = categoryId;
  }
  const status = readOptionalQueryValue(values.status);
  if (status === "booked" || status === "planned") {
    filters.status = status;
  }
  const ownerContext = readOptionalQueryValue(values.ownerContext);
  if (ownerContext !== undefined) {
    filters.ownerContext = parseOwnerContext(ownerContext);
  }

  return filters;
}

function readOptionalQueryValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readForm(body: unknown): FormBody {
  if (typeof body !== "object" || body === null) {
    return {};
  }

  return body as FormBody;
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
  if (
    typeof params !== "object" ||
    params === null ||
    typeof (params as { id?: unknown }).id !== "string"
  ) {
    throw new Error("Route id is required");
  }

  return (params as { id: string }).id;
}

function renderMasterDataPage(
  accounts: RenderableAccount[],
  categories: RenderableCategory[],
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FamilyFlow Master Data</title>
  </head>
  <body>
    <main>
      <h1>Master Data</h1>
      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Accounts</h2>
        <ul>${accounts.map((account) => `<li>${escapeHtml(account.name)} (${escapeHtml(account.ownerContext)})</li>`).join("")}</ul>
      </section>
      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading">Categories</h2>
        <ul>${categories.map((category) => `<li>${escapeHtml(category.name)}</li>`).join("")}</ul>
      </section>
    </main>
  </body>
</html>`;
}

function renderTransactionsPage(input: {
  accounts: RenderableAccount[];
  categories: RenderableCategory[];
  transactions: Transaction[];
  filters: TransactionFilters;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FamilyFlow Transactions</title>
  </head>
  <body>
    <main>
      <h1>Transactions</h1>
      ${renderTransactionForm({ accounts: input.accounts, categories: input.categories })}
      ${renderTransactionFilters(input)}
      ${renderTransactionList(input.transactions)}
    </main>
  </body>
</html>`;
}

function renderTransactionEditPage(input: {
  accounts: RenderableAccount[];
  categories: RenderableCategory[];
  transaction: Transaction;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Edit Transaction</title>
  </head>
  <body>
    <main>
      <h1>Edit Transaction</h1>
      ${renderTransactionForm(input)}
    </main>
  </body>
</html>`;
}

function renderTransactionForm(input: {
  accounts: RenderableAccount[];
  categories: RenderableCategory[];
  transaction?: Transaction;
}): string {
  const transaction = input.transaction;
  const action =
    transaction === undefined
      ? "/transactions"
      : `/transactions/${encodeURIComponent(transaction.id)}`;
  const button = transaction === undefined ? "Add transaction" : "Save transaction";

  return `<form method="post" action="${action}">
    <label>Transaction account
      <select name="accountId">${input.accounts.map((account) => renderOption(account.id, account.name, transaction?.accountId)).join("")}</select>
    </label>
    <label>Category
      <select name="categoryId">${input.categories.map((category) => renderOption(category.id, category.name, transaction?.categoryId)).join("")}</select>
    </label>
    <label>Date <input name="date" type="date" value="${escapeHtml(transaction?.date ?? "")}" required></label>
    <label>Description <input name="description" value="${escapeHtml(transaction?.description ?? "")}" required></label>
    <label>Payee <input name="payee" value="${escapeHtml(transaction?.payee ?? "")}"></label>
    <label>Amount <input name="amount" inputmode="decimal" value="${escapeHtml(transaction === undefined ? "" : formatAmount(transaction.amountCents))}" required></label>
    <label>Transaction status
      <select name="status">
        ${renderOption("booked", "booked", transaction?.status)}
        ${renderOption("planned", "planned", transaction?.status)}
      </select>
    </label>
    <label>Fixed cost <input name="fixedCost" type="checkbox" ${transaction?.fixedCost === true ? "checked" : ""}></label>
    <label>Note <textarea name="note">${escapeHtml(transaction?.note ?? "")}</textarea></label>
    <button type="submit">${button}</button>
  </form>`;
}

function renderTransactionFilters(input: {
  accounts: RenderableAccount[];
  categories: RenderableCategory[];
  filters: TransactionFilters;
}): string {
  return `<form method="get" action="/transactions">
    <label>Month <input name="month" type="month" value="${escapeHtml(input.filters.month ?? "")}"></label>
    <label>Filter account
      <select name="accountId"><option value="">All accounts</option>${input.accounts.map((account) => renderOption(account.id, account.name, input.filters.accountId)).join("")}</select>
    </label>
    <label>Owner context
      <select name="ownerContext">
        <option value="">All owners</option>
        ${renderOption("person_a", "Person A", input.filters.ownerContext)}
        ${renderOption("person_b", "Person B", input.filters.ownerContext)}
        ${renderOption("shared", "Shared", input.filters.ownerContext)}
      </select>
    </label>
    <label>Category
      <select name="categoryId"><option value="">All categories</option>${input.categories.map((category) => renderOption(category.id, category.name, input.filters.categoryId)).join("")}</select>
    </label>
    <label>Filter status
      <select name="status"><option value="">All statuses</option>${renderOption("booked", "booked", input.filters.status)}${renderOption("planned", "planned", input.filters.status)}</select>
    </label>
    <button type="submit">Apply filters</button>
  </form>`;
}

function renderTransactionList(transactions: Transaction[]): string {
  if (transactions.length === 0) {
    return "<p>No transactions found.</p>";
  }

  return `<table>
    <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th>Fixed cost</th><th>Actions</th></tr></thead>
    <tbody>${transactions.map(renderTransactionRow).join("")}</tbody>
  </table>`;
}

function renderTransactionRow(transaction: Transaction): string {
  return `<tr>
    <td>${escapeHtml(transaction.date)}</td>
    <td>${escapeHtml(transaction.description)}</td>
    <td>${formatAmount(transaction.amountCents)}</td>
    <td>${escapeHtml(transaction.status)}</td>
    <td>${transaction.fixedCost ? "fixed" : "variable"}</td>
    <td>
      <a href="/transactions/${encodeURIComponent(transaction.id)}/edit">Edit ${escapeHtml(transaction.description)}</a>
      <form method="post" action="/transactions/${encodeURIComponent(transaction.id)}/delete" style="display:inline">
        <button type="submit">Delete ${escapeHtml(transaction.description)}</button>
      </form>
    </td>
  </tr>`;
}

function renderOption(
  value: string,
  label: string,
  selectedValue: string | OwnerContext | undefined,
): string {
  return `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function formatAmount(amountCents: number): string {
  return (Math.abs(amountCents) / 100).toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function main() {
  const config = loadConfig();
  await migrate(config.databaseUrl);

  const connection = createPostgresConnection(config.databaseUrl);
  const repositories = {
    accounts: new DrizzleAccountRepository(connection.db),
    categories: new DrizzleCategoryRepository(connection.db),
    transactions: new DrizzleTransactionRepository(connection.db),
  };

  await seedMasterData(repositories);

  const server = buildServer({
    repositories,
    auth: {
      ...config.auth,
      baseUrl: config.baseUrl,
    },
  });

  server.addHook("onClose", async () => {
    await connection.client.end();
  });

  await server.listen({ host: config.host, port: config.port });
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
