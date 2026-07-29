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
import { registerStaticAssets } from "../adapters/http/assets.js";
import { registerAuth, type AuthRuntimeConfig } from "../adapters/http/auth.js";
import { registerRequestLifecycle } from "../adapters/http/request-lifecycle.js";
import { renderMasterDataPage } from "../adapters/http/templates/master-data.js";
import {
  renderTransactionEditPage,
  renderTransactionListSection,
  renderTransactionsPage,
  renderTransactionsPanel,
} from "../adapters/http/templates/transactions.js";
import { HumanReadableRequestLogger } from "../adapters/logging/human-readable-logger.js";
import { parseOwnerContext } from "../core/shared/owner-context.js";
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

  registerStaticAssets(server);
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

    const body = renderTransactionsPage({ accounts, categories, transactions, filters });

    if (isHtmxRequest(request.headers)) {
      return reply
        .type("text/html; charset=utf-8")
        .send(renderTransactionListSection(transactions));
    }

    return reply.type("text/html; charset=utf-8").send(body);
  });
  server.post("/transactions", async (request, reply) => {
    try {
      const form = readForm(request.body);
      const transaction = createTransactionFromForm(form, randomUUID());
      await repositories.transactions.save(transaction);
    } catch (error: unknown) {
      if (isHtmxRequest(request.headers)) {
        const [accounts, categories, transactions] = await Promise.all([
          repositories.accounts.list(),
          repositories.categories.list(),
          repositories.transactions.list({}),
        ]);

        return reply
          .status(400)
          .type("text/html; charset=utf-8")
          .send(
            renderTransactionsPanel({
              accounts,
              categories,
              transactions,
              filters: {},
              formError: error instanceof Error ? error.message : "Transaction could not be saved",
            }),
          );
      }

      throw error;
    }

    if (isHtmxRequest(request.headers)) {
      const transactions = await repositories.transactions.list({});

      return reply
        .type("text/html; charset=utf-8")
        .send(renderTransactionListSection(transactions));
    }

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

    if (isHtmxRequest(request.headers)) {
      const [accounts, categories, transactions] = await Promise.all([
        repositories.accounts.list(),
        repositories.categories.list(),
        repositories.transactions.list({}),
      ]);

      return reply
        .type("text/html; charset=utf-8")
        .send(renderTransactionsPanel({ accounts, categories, transactions, filters: {} }));
    }

    return reply.redirect("/transactions");
  });
  server.post("/transactions/:id/delete", async (request, reply) => {
    await repositories.transactions.delete(readRouteId(request.params));

    if (isHtmxRequest(request.headers)) {
      return reply
        .type("text/html; charset=utf-8")
        .send(renderTransactionListSection(await repositories.transactions.list({})));
    }

    return reply.redirect("/transactions");
  });

  return server;
}

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

function isHtmxRequest(headers: Record<string, string | string[] | undefined>): boolean {
  return headers["hx-request"] === "true";
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
