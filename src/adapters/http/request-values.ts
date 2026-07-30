export type FormBody = Record<string, string | undefined>;

export function readForm(body: unknown): FormBody {
  if (typeof body !== "object" || body === null) {
    return {};
  }

  const form: FormBody = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" || value === undefined) {
      form[key] = value;
    }
  }

  return form;
}

export function readOptionalQueryValue(query: object, key: string): string | undefined {
  const value = Object.entries(query).find(([candidate]) => candidate === key)?.[1];

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function readRouteId(params: unknown): string {
  if (typeof params !== "object" || params === null || !("id" in params)) {
    throw new Error("Route id is required");
  }

  const { id } = params;
  if (typeof id !== "string") {
    throw new Error("Route id is required");
  }

  return id;
}

export function isHtmxRequest(headers: Record<string, string | string[] | undefined>): boolean {
  return headers["hx-request"] === "true";
}
