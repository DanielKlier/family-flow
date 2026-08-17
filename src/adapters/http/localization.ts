import type { FastifyInstance } from "fastify";

import type { Localization } from "../../ports/localization/localization.js";

declare module "fastify" {
  interface FastifyInstance {
    localization: Localization;
  }
}

export function registerLocalization(server: FastifyInstance, localization: Localization): void {
  server.decorate("localization", localization);
}
