import { fileURLToPath } from "node:url";

import Fastify from "fastify";

import {
  SecureSessionTokenGenerator,
  Sha256SessionTokenHasher,
} from "../adapters/auth/session-cryptography.js";
import { SystemClock } from "../adapters/clock/system-clock.js";
import { SimpleCsvParser } from "../adapters/csv/simple-csv-parser.js";
import { createSeededInMemoryRepositories } from "../adapters/db/default-repositories.js";
import { DrizzleAccountRepository } from "../adapters/db/drizzle-account-repository.js";
import { DrizzleCategorizationRuleRepository } from "../adapters/db/drizzle-categorization-rule-repository.js";
import { DrizzleCategoryRepository } from "../adapters/db/drizzle-category-repository.js";
import { DrizzleImportPreviewBatchRepository } from "../adapters/db/drizzle-import-preview-batch-repository.js";
import { DrizzleImportProfileRepository } from "../adapters/db/drizzle-import-profile-repository.js";
import { DrizzleIncomeRepository } from "../adapters/db/drizzle-income-repository.js";
import { DrizzleOwnerContextRepository } from "../adapters/db/drizzle-owner-context-repository.js";
import { DrizzleSessionStore } from "../adapters/db/drizzle-session-store.js";
import { DrizzleTransactionRepository } from "../adapters/db/drizzle-transaction-repository.js";
import { InMemoryImportPreviewBatchRepository } from "../adapters/db/in-memory-import-preview-batch-repository.js";
import { InMemorySessionStore } from "../adapters/db/in-memory-session-store.js";
import { migrate } from "../adapters/db/migrate.js";
import { createPostgresConnection } from "../adapters/db/postgres.js";
import {
  type ImportProfileRepositories,
  seedImportProfiles,
} from "../adapters/db/seeds/import-profiles.js";
import { type MasterDataRepositories, seedMasterData } from "../adapters/db/seeds/master-data.js";
import { registerStaticAssets } from "../adapters/http/assets.js";
import { type AuthRuntimeConfig, registerAuth } from "../adapters/http/auth.js";
import { registerCategorizationRuleRoutes } from "../adapters/http/categorization-rules.js";
import { registerFormParser } from "../adapters/http/form-parser.js";
import { registerCsvImportRoutes } from "../adapters/http/imports.js";
import { registerIncomeRoutes } from "../adapters/http/income.js";
import { registerLocalization } from "../adapters/http/localization.js";
import { registerMasterDataRoutes } from "../adapters/http/master-data.js";
import { registerRequestLifecycle } from "../adapters/http/request-lifecycle.js";
import { registerTransactionRoutes } from "../adapters/http/transactions.js";
import { createFamilyFlowViews, registerTemplateRenderer } from "../adapters/http/views.js";
import { createGermanLocalization as createLocalization } from "../adapters/localization/german.js";
import { HumanReadableRequestLogger } from "../adapters/logging/human-readable-logger.js";
import { SessionService } from "../core/auth/session-service.js";
import type { Clock } from "../ports/clock/clock.js";
import type { CsvParser } from "../ports/csv/csv-parser.js";
import type { RequestLogger } from "../ports/logging/logger.js";
import type { Localization } from "../ports/localization/localization.js";
import type { CategorizationRuleRepository } from "../ports/repositories/categorization-rule-repository.js";
import type { ImportPreviewBatchRepository } from "../ports/repositories/import-preview-batch-repository.js";
import type { IncomeRepository } from "../ports/repositories/income-repository.js";
import type { TransactionRepository } from "../ports/repositories/transaction-repository.js";
import { loadConfig } from "./config.js";

type AppRepositories = MasterDataRepositories &
  ImportProfileRepositories & {
    categorizationRules: CategorizationRuleRepository;
    income: IncomeRepository;
    transactions: TransactionRepository;
  };

type ServerOptions = {
  logger?: RequestLogger;
  repositories?: AppRepositories;
  csvParser?: CsvParser;
  auth?: AuthRuntimeConfig;
  sessions?: SessionService;
  importPreviewBatches?: ImportPreviewBatchRepository;
  clock?: Clock;
  localization?: Localization;
};

export function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: false,
    bodyLimit: 6 * 1024 * 1024,
  });
  const logger = options.logger ?? new HumanReadableRequestLogger();
  const localization = options.localization ?? createLocalization();
  const repositories = options.repositories ?? createSeededInMemoryRepositories(localization);
  const csvParser = options.csvParser ?? new SimpleCsvParser();
  const clock = options.clock ?? new SystemClock();
  const importPreviewBatches =
    options.importPreviewBatches ??
    new InMemoryImportPreviewBatchRepository(repositories.transactions);
  const auth =
    options.auth ??
    ({
      mode: "test",
      baseUrl: "http://127.0.0.1:3000",
      oidc: null,
    } satisfies AuthRuntimeConfig);
  const sessions =
    options.sessions ??
    new SessionService(
      new InMemorySessionStore(),
      new SystemClock(),
      new SecureSessionTokenGenerator(),
      new Sha256SessionTokenHasher(),
    );

  registerLocalization(server, localization);
  registerFormParser(server);
  registerRequestLifecycle(server, logger);
  registerTemplateRenderer(server);
  registerAuth(server, auth, sessions);

  registerStaticAssets(server);
  server.get("/health", async () => ({ status: "ok" }));
  registerMasterDataRoutes(server, repositories);
  registerTransactionRoutes(server, repositories);
  registerCategorizationRuleRoutes(server, repositories);
  registerCsvImportRoutes(server, { ...repositories, importPreviewBatches }, csvParser, clock);
  registerIncomeRoutes(server, repositories);

  server.setNotFoundHandler(async (_request, reply) => {
    const requestId = String(reply.getHeader("x-request-id"));
    return reply
      .status(404)
      .type("text/html; charset=utf-8")
      .send(await createFamilyFlowViews(reply).notFoundPage(requestId));
  });
  server.setErrorHandler(async (error, _request, reply) => {
    const requestId = String(reply.getHeader("x-request-id"));
    const statusCode =
      typeof error === "object" && error !== null ? Reflect.get(error, "statusCode") : undefined;
    const clientErrorStatus =
      typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 ? statusCode : null;
    const views = createFamilyFlowViews(reply);
    const body =
      clientErrorStatus === null
        ? await views.unexpectedErrorPage(requestId)
        : await views.badRequestPage(localization.text("error.requestFailed"), requestId);
    return reply
      .status(clientErrorStatus ?? 500)
      .type("text/html; charset=utf-8")
      .send(body);
  });

  return server;
}

async function main() {
  const config = loadConfig();
  await migrate(config.databaseUrl);

  const connection = createPostgresConnection(config.databaseUrl);
  const repositories = {
    accounts: new DrizzleAccountRepository(connection.db),
    categories: new DrizzleCategoryRepository(connection.db),
    categorizationRules: new DrizzleCategorizationRuleRepository(connection.db),
    income: new DrizzleIncomeRepository(connection.db),
    importProfiles: new DrizzleImportProfileRepository(connection.db),
    ownerContexts: new DrizzleOwnerContextRepository(connection.db),
    transactions: new DrizzleTransactionRepository(connection.db),
  };

  const localization = createLocalization();
  await seedMasterData(repositories, localization);
  await seedImportProfiles(repositories);

  const sessions = new SessionService(
    new DrizzleSessionStore(connection.db),
    new SystemClock(),
    new SecureSessionTokenGenerator(),
    new Sha256SessionTokenHasher(),
  );
  const deletedSessions = await sessions.cleanup(1_000);
  console.info(`Session cleanup deleted ${deletedSessions} row(s)`);

  const server = buildServer({
    repositories,
    localization,
    auth: {
      ...config.auth,
      baseUrl: config.baseUrl,
    },
    sessions,
    importPreviewBatches: new DrizzleImportPreviewBatchRepository(connection.db),
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
