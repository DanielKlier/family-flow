import { readFile } from "node:fs/promises";

import type { FastifyInstance } from "fastify";

const stylesheetUrl = new URL("./assets/app.css", import.meta.url);
const htmxScriptUrl = new URL("../../../node_modules/htmx.org/dist/htmx.min.js", import.meta.url);

let appStylesheet: Promise<string> | null = null;
let htmxScript: Promise<string> | null = null;

export function registerStaticAssets(server: FastifyInstance): void {
  server.get("/assets/app.css", async (_request, reply) => {
    return reply.type("text/css; charset=utf-8").send(await readAppStylesheet());
  });

  server.get("/assets/htmx.min.js", async (_request, reply) => {
    return reply.type("application/javascript; charset=utf-8").send(await readHtmxScript());
  });
}

function readAppStylesheet(): Promise<string> {
  appStylesheet ??= readFile(stylesheetUrl, "utf8");

  return appStylesheet;
}

function readHtmxScript(): Promise<string> {
  htmxScript ??= readFile(htmxScriptUrl, "utf8");

  return htmxScript;
}
