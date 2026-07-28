import { fileURLToPath } from "node:url";

import Fastify from "fastify";

import { createSeededInMemoryRepositories } from "../adapters/db/default-repositories.js";
import { DrizzleAccountRepository } from "../adapters/db/drizzle-account-repository.js";
import { DrizzleCategoryRepository } from "../adapters/db/drizzle-category-repository.js";
import { migrate } from "../adapters/db/migrate.js";
import { createPostgresConnection } from "../adapters/db/postgres.js";
import { seedMasterData, type MasterDataRepositories } from "../adapters/db/seeds/master-data.js";
import { registerRequestLifecycle } from "../adapters/http/request-lifecycle.js";
import { HumanReadableRequestLogger } from "../adapters/logging/human-readable-logger.js";
import type { RequestLogger } from "../ports/logging/logger.js";
import { loadConfig } from "./config.js";

type ServerOptions = {
  logger?: RequestLogger;
  repositories?: MasterDataRepositories;
};

export function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: false,
  });
  const logger = options.logger ?? new HumanReadableRequestLogger();
  const repositories = options.repositories ?? createSeededInMemoryRepositories();

  registerRequestLifecycle(server, logger);

  server.get("/health", async () => ({ status: "ok" }));
  server.get("/admin/master-data", async (_request, reply) => {
    const [accounts, categories] = await Promise.all([
      repositories.accounts.list(),
      repositories.categories.list(),
    ]);

    return reply.type("text/html; charset=utf-8").send(renderMasterDataPage(accounts, categories));
  });

  return server;
}

type RenderableAccount = Awaited<ReturnType<MasterDataRepositories["accounts"]["list"]>>[number];
type RenderableCategory = Awaited<ReturnType<MasterDataRepositories["categories"]["list"]>>[number];

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
  };

  await seedMasterData(repositories);

  const server = buildServer({ repositories });

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
