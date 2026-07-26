export type RequestLogEntry = {
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  statusCode: number;
  durationMs: number;
  user: string | null;
  outcome: "success" | "error";
  error: string | null;
};

export type RequestLogger = {
  logRequest(entry: RequestLogEntry): void;
};
