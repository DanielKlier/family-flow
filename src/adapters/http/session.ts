export const sessionCookieName = "ff_session";

export function serializeSessionCookie(value: string, expiresAt: Date, secure: boolean): string {
  return `${sessionCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800; Expires=${expiresAt.toUTCString()}${secure ? "; Secure" : ""}`;
}

export function serializeExpiredSessionCookie(secure: boolean): string {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`;
}
