export type RequestLogError = {
  type: string;
  message: string;
};

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
  error: RequestLogError | null;
};

export type RequestLogger = {
  logRequest(entry: RequestLogEntry): void;
};
