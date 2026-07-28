import { randomUUID } from "node:crypto";
import { STATUS_CODES } from "node:http";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { normalizeQueryForLog } from "../logging/request-log-context.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import type { RequestLogger } from "../../ports/logging/logger.js";

type RequestWithLogContext = FastifyRequest & {
  userContext?: UserContext;
  requestLogContext?: {
    requestId: string;
    startedAt: bigint;
    error: string | null;
  };
};

export function registerRequestLifecycle(server: FastifyInstance, logger: RequestLogger): void {
  server.addHook("onRequest", async (request: RequestWithLogContext, reply: FastifyReply) => {
    const requestId = readRequestId(request) ?? randomUUID();

    request.requestLogContext = {
      requestId,
      startedAt: process.hrtime.bigint(),
      error: null,
    };
    reply.header("X-Request-Id", requestId);
  });

  server.addHook("onError", async (request: RequestWithLogContext, _reply, error) => {
    if (request.requestLogContext !== undefined) {
      request.requestLogContext.error = error.message;
    }
  });

  server.addHook("onResponse", async (request: RequestWithLogContext, reply: FastifyReply) => {
    const context = request.requestLogContext;
    if (context === undefined) {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - context.startedAt) / 1_000_000;
    const path = new URL(request.url, "http://localhost").pathname;
    const error =
      context.error ??
      (reply.statusCode >= 400 ? (STATUS_CODES[reply.statusCode] ?? "Error") : null);

    logger.logRequest({
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
      method: request.method,
      path,
      query: normalizeQueryForLog(request.query as Record<string, string | string[] | undefined>),
      statusCode: reply.statusCode,
      durationMs,
      user: request.userContext?.id ?? null,
      outcome: reply.statusCode >= 400 ? "error" : "success",
      error,
    });
  });
}

function readRequestId(request: FastifyRequest): string | null {
  const header = request.headers["x-request-id"];

  if (typeof header === "string" && header.trim() !== "") {
    return header;
  }

  return null;
}
