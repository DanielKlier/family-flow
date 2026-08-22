import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { UserContext } from "../../ports/auth/user-context.js";
import type { RequestLogError, RequestLogger } from "../../ports/logging/logger.js";
import { normalizeQueryForLog } from "../logging/request-log-context.js";
import { parseCanonicalRequestId } from "./request-id.js";

type RequestWithLogContext = FastifyRequest & {
  userContext?: UserContext;
  requestLogContext?: {
    requestId: string;
    startedAt: bigint;
    error: RequestLogError | null;
  };
};

export function registerRequestLifecycle(server: FastifyInstance, logger: RequestLogger): void {
  server.addHook("onRequest", async (request: RequestWithLogContext, reply: FastifyReply) => {
    const requestId = parseCanonicalRequestId(request.headers["x-request-id"]) ?? randomUUID();

    request.requestLogContext = {
      requestId,
      startedAt: process.hrtime.bigint(),
      error: null,
    };
    reply.header("X-Request-Id", requestId);
  });

  server.addHook("onError", async (request: RequestWithLogContext, _reply, error) => {
    if (request.requestLogContext !== undefined) {
      request.requestLogContext.error = safeErrorForStatus(errorStatusCode(error));
    }
  });

  server.addHook("onResponse", async (request: RequestWithLogContext, reply: FastifyReply) => {
    const context = request.requestLogContext;
    if (context === undefined) {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - context.startedAt) / 1_000_000;
    const path = new URL(request.url, "http://localhost").pathname;

    logger.logRequest({
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
      method: request.method,
      path,
      query: normalizeQueryForLog(request.query),
      statusCode: reply.statusCode,
      durationMs,
      user: request.userContext?.id ?? null,
      outcome: reply.statusCode >= 400 ? "error" : "success",
      error:
        context.error ?? (reply.statusCode >= 400 ? safeErrorForStatus(reply.statusCode) : null),
    });
  });
}

function errorStatusCode(error: unknown): number {
  if (typeof error !== "object" || error === null) {
    return 500;
  }

  const statusCode = Reflect.get(error, "statusCode");
  return typeof statusCode === "number" ? statusCode : 500;
}

function safeErrorForStatus(statusCode: number): RequestLogError {
  if (statusCode >= 500) {
    return { type: "unexpected-error", message: "Unexpected server error" };
  }

  if (statusCode === 401) {
    return { type: "authentication-error", message: "Authentication failed" };
  }

  if (statusCode === 403) {
    return { type: "authorization-error", message: "Request forbidden" };
  }

  if (statusCode === 404) {
    return { type: "not-found", message: "Resource not found" };
  }

  return { type: "invalid-request", message: "Request validation failed" };
}
