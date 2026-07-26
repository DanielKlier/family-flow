import type { RequestLogEntry, RequestLogger } from "../../ports/logging/logger.js";

export class HumanReadableRequestLogger implements RequestLogger {
  logRequest(entry: RequestLogEntry): void {
    const query =
      Object.keys(entry.query).length > 0 ? ` query=${JSON.stringify(entry.query)}` : "";
    const error = entry.error === null ? "" : ` error=${JSON.stringify(entry.error)}`;
    const user = entry.user === null ? "anonymous" : entry.user;

    console.log(
      `${entry.timestamp} request_id=${entry.requestId} method=${entry.method} path=${entry.path}${query} status=${entry.statusCode} duration_ms=${entry.durationMs.toFixed(3)} user=${user} outcome=${entry.outcome}${error}`,
    );
  }
}
