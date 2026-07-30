import { fileURLToPath } from "node:url";

import Fastify from "fastify";

import { createSeededInMemoryRepositories } from "../adapters/db/default-repositories.js";
import { SimpleCsvParser } from "../adapters/csv/simple-csv-parser.js";
import { DrizzleAccountRepository } from "../adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../adapters/db/drizzle-category-repository.js";
import { DrizzleImportProfileRepository } from "../adapters/db/drizzle-import-profile-repository.js";
import { DrizzleTransactionRepository } from "../adapters/db/drizzle-transaction-repository.js";
import { migrate } from "../adapters/db/migrate.js";
import { createPostgresConnection } from "../adapters/db/postgres.js";
import {
  seedImportProfiles,
  type ImportProfileRepositories,
} from "../adapters/db/seeds/import-profiles.js";
import { seedMasterData, type MasterDataRepositories } from "../adapters/db/seeds/master-data.js";
import { registerStaticAssets } from "../adapters/http/assets.js";
import { registerAuth, type AuthRuntimeConfig } from "../adapters/http/auth.js";
import { registerFormParser } from "../adapters/http/form-parser.js";
import { registerCsvImportRoutes } from "../adapters/http/imports.js";
import { registerRequestLifecycle } from "../adapters/http/request-lifecycle.js";
import { renderMasterDataPage } from "../adapters/http/templates/master-data.js";
import { registerTransactionRoutes } from "../adapters/http/transactions.js";
import { HumanReadableRequestLogger } from "../adapters/logging/human-readable-logger.js";
import type { RequestLogger } from "../ports/logging/logger.js";
import type { CsvParser } from "../ports/csv/csv-parser.js";
import type { TransactionRepository } from "../ports/repositories/transaction-repository.js";
import { loadConfig } from "./config.js";

type AppRepositories = MasterDataRepositories &
  ImportProfileRepositories & {
    transactions: TransactionRepository;
  };

type ServerOptions = {
  logger?: RequestLogger;
  repositories?: AppRepositories;
  csvParser?: CsvParser;
  auth?: AuthRuntimeConfig;
};

export function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: false,
  });
  const logger = options.logger ?? new HumanReadableRequestLogger();
  const repositories = options.repositories ?? createSeededInMemoryRepositories();
  const csvParser = options.csvParser ?? new SimpleCsvParser();
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
  registerTransactionRoutes(server, repositories);
  registerCsvImportRoutes(server, repositories, csvParser);

  return server;
}

async function main() {
  const config = loadConfig();
  await migrate(config.databaseUrl);

  const connection = createPostgresConnection(config.databaseUrl);
  const repositories = {
    accounts: new DrizzleAccountRepository(connection.db),
    categories: new DrizzleCategoryRepository(connection.db),
    importProfiles: new DrizzleImportProfileRepository(connection.db),
    transactions: new DrizzleTransactionRepository(connection.db),
  };

  await seedMasterData(repositories);
  await seedImportProfiles(repositories);

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
