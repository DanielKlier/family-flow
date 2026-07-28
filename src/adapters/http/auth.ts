import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

import {
  buildAuthorizationUrl,
  buildEndSessionUrl,
  exchangeAuthorizationCode,
  type OidcRuntimeConfig,
} from "../oidc/authentik-oidc.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import {
  createSessionCookieValue,
  readSessionCookieValue,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  sessionCookieName,
} from "./session.js";

export type AuthRuntimeConfig = {
  mode: "test" | "oidc";
  sessionSecret: string;
  baseUrl: string;
  oidc: OidcRuntimeConfig | null;
};

type RequestWithUser = FastifyRequest & {
  userContext?: UserContext;
};

const testUser: UserContext = {
  id: "test-user",
  displayName: "Test User",
  email: "test.user@example.invalid",
};

const publicPaths = new Set([
  "/health",
  "/auth/login",
  "/auth/callback",
  "/auth/logout",
  "/auth/test-login",
]);
const oidcStateCookieName = "ff_oidc_state";

export function registerAuth(server: FastifyInstance, config: AuthRuntimeConfig): void {
  const secureCookie = config.baseUrl.startsWith("https://");

  server.addHook("preHandler", async (request: RequestWithUser, reply) => {
    const path = getPath(request.url);
    const user = readSessionCookieValue(
      readCookie(request.headers.cookie, sessionCookieName),
      config.sessionSecret,
    );
    if (user !== null) {
      request.userContext = user;
    }

    if (publicPaths.has(path)) {
      return;
    }

    if (user === null) {
      return reply.redirect(`/auth/login?returnTo=${encodeURIComponent(request.url)}`);
    }
  });

  server.get("/", async (request: RequestWithUser, reply) => {
    const user = request.userContext;
    if (user === undefined) {
      return reply.status(500).send("Missing authenticated user context");
    }

    return reply.type("text/html; charset=utf-8").send(renderDashboard(user));
  });

  server.get("/auth/login", async (request, reply) => {
    const returnTo = readSafeReturnTo(request.query);
    if (config.mode === "test") {
      return reply.type("text/html; charset=utf-8").send(renderLoginPage(returnTo));
    }

    if (config.oidc === null) {
      return reply.status(500).send("OIDC configuration is missing");
    }

    const state = randomUUID();
    reply.header("Set-Cookie", serializeNamedCookie(oidcStateCookieName, state, secureCookie));

    return reply.redirect(buildAuthorizationUrl(config.oidc, config.baseUrl, state));
  });

  server.get("/auth/test-login", async (request, reply) => {
    if (config.mode !== "test") {
      return reply.status(404).send("Not Found");
    }

    const returnTo = readSafeReturnTo(request.query);
    const cookie = createSessionCookieValue(testUser, config.sessionSecret);
    reply.header("Set-Cookie", serializeSessionCookie(cookie, secureCookie));

    return reply.redirect(returnTo);
  });

  server.get("/auth/callback", async (request, reply) => {
    if (config.mode !== "oidc" || config.oidc === null) {
      return reply.status(404).send("Not Found");
    }

    const query = readCallbackQuery(request.query);
    const expectedState = readCookie(request.headers.cookie, oidcStateCookieName);
    if (query === null || expectedState === undefined || query.state !== expectedState) {
      return reply.status(400).send("Invalid OIDC callback state");
    }

    const oidcUser = await exchangeAuthorizationCode(config.oidc, config.baseUrl, query.code);
    const user: UserContext = {
      id: oidcUser.sub,
      displayName: oidcUser.name ?? oidcUser.preferred_username ?? oidcUser.email ?? oidcUser.sub,
      email: oidcUser.email ?? null,
    };
    const cookie = createSessionCookieValue(user, config.sessionSecret);
    reply.header("Set-Cookie", [
      serializeSessionCookie(cookie, secureCookie),
      serializeExpiredNamedCookie(oidcStateCookieName, secureCookie),
    ]);

    return reply.redirect("/");
  });

  server.get("/auth/logout", async (_request, reply) => {
    reply.header("Set-Cookie", serializeExpiredSessionCookie(secureCookie));

    if (config.mode === "oidc" && config.oidc !== null) {
      return reply.redirect(buildEndSessionUrl(config.oidc, config.baseUrl));
    }

    return reply.redirect("/auth/login");
  });
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) {
    return undefined;
  }

  return header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function readSafeReturnTo(query: unknown): string {
  if (typeof query !== "object" || query === null || !("returnTo" in query)) {
    return "/";
  }

  const returnTo = (query as { returnTo?: unknown }).returnTo;
  if (typeof returnTo !== "string" || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/";
  }

  return returnTo;
}

function readCallbackQuery(query: unknown): { code: string; state: string } | null {
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

function serializeNamedCookie(name: string, value: string, secure: boolean): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function serializeExpiredNamedCookie(name: string, secure: boolean): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function getPath(url: string): string {
  return new URL(url, "http://localhost").pathname;
}

function renderLoginPage(returnTo: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>FamilyFlow Login</title></head>
  <body>
    <main>
      <h1>Login</h1>
      <a href="/auth/test-login?returnTo=${encodeURIComponent(returnTo)}">Sign in as Test User</a>
    </main>
  </body>
</html>`;
}

function renderDashboard(user: UserContext): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>FamilyFlow Dashboard</title></head>
  <body>
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as ${escapeHtml(user.displayName)}</p>
      <nav><a href="/admin/master-data">Master Data</a> <a href="/auth/logout">Logout</a></nav>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
