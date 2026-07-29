import { createHmac } from "node:crypto";

import type { UserContext } from "../../ports/auth/user-context.js";

export const sessionCookieName = "ff_session";

type SessionPayload = UserContext & {
  expiresAt: string;
};

export function createSessionCookieValue(
  user: UserContext,
  secret: string,
  now = new Date(),
): string {
  const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
  const payload = encodeBase64Url(JSON.stringify({ ...user, expiresAt } satisfies SessionPayload));
  const signature = sign(payload, secret);

  return `${payload}.${signature}`;
}

export function readSessionCookieValue(
  value: string | undefined,
  secret: string,
): UserContext | null {
  if (value === undefined) {
    return null;
  }

  const [payload, signature] = value.split(".");
  if (payload === undefined || signature === undefined || sign(payload, secret) !== signature) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof session !== "object" ||
      session === null ||
      typeof session.id !== "string" ||
      typeof session.displayName !== "string" ||
      !(typeof session.email === "string" || session.email === null) ||
      typeof session.expiresAt !== "string" ||
      Date.parse(session.expiresAt) <= Date.now()
    ) {
      return null;
    }

    return {
      id: session.id,
      displayName: session.displayName,
      email: session.email,
    };
  } catch {
    return null;
  }
}

export function serializeSessionCookie(value: string, secure: boolean): string {
  return `${sessionCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function serializeExpiredSessionCookie(secure: boolean): string {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}
