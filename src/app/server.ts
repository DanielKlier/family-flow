import { fileURLToPath } from "node:url";

import Fastify from "fastify";

import { loadConfig } from "./config.js";

export function buildServer() {
  const server = Fastify({
    logger: false,
  });

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
