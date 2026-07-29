export function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) {
    return undefined;
  }

  return header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function readSafeReturnTo(query: unknown): string {
  if (typeof query !== "object" || query === null || !("returnTo" in query)) {
    return "/";
  }

  const returnTo = readObjectValue(query, "returnTo");
  if (typeof returnTo !== "string" || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/";
  }

  return returnTo;
}

export function readCallbackQuery(query: unknown): { code: string; state: string } | null {
  if (typeof query !== "object" || query === null) {
    return null;
  }

  const code = readObjectValue(query, "code");
  const state = readObjectValue(query, "state");
  if (typeof code !== "string" || typeof state !== "string") {
    return null;
  }

  return {
    code,
    state,
  };
}

export function serializeNamedCookie(name: string, value: string, secure: boolean): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function serializeExpiredNamedCookie(name: string, secure: boolean): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function getPath(url: string): string {
  return new URL(url, "http://localhost").pathname;
}

function readObjectValue(input: object, key: string): unknown {
  return Object.entries(input).find(([candidate]) => candidate === key)?.[1];
}
