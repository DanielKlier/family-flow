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

  const returnTo = (query as { returnTo?: unknown }).returnTo;
  if (typeof returnTo !== "string" || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/";
  }

  return returnTo;
}

export function readCallbackQuery(query: unknown): { code: string; state: string } | null {
  if (typeof query !== "object" || query === null) {
    return null;
  }

  const candidate = query as { code?: unknown; state?: unknown };
  if (typeof candidate.code !== "string" || typeof candidate.state !== "string") {
    return null;
  }

  return {
    code: candidate.code,
    state: candidate.state,
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
