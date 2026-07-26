import { fileURLToPath } from "node:url";

import Fastify from "fastify";

import { registerRequestLifecycle } from "../adapters/http/request-lifecycle.js";
import { HumanReadableRequestLogger } from "../adapters/logging/human-readable-logger.js";
import type { RequestLogger } from "../ports/logging/logger.js";
import { loadConfig } from "./config.js";

type ServerOptions = {
  logger?: RequestLogger;
};

export function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: false,
  });
  const logger = options.logger ?? new HumanReadableRequestLogger();

  registerRequestLifecycle(server, logger);

  server.get("/health", async () => ({ status: "ok" }));

  return server;
}

async function main() {
  const config = loadConfig();
  const server = buildServer();

  await server.listen({ host: config.host, port: config.port });
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
