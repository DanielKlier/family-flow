import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

import {
  buildAuthorizationUrl,
  buildEndSessionUrl,
  discoverOidcProvider,
  exchangeAuthorizationCode,
  type OidcProviderMetadata,
  type OidcRuntimeConfig,
} from "../oidc/authentik-oidc.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import {
  getPath,
  readCallbackQuery,
  readCookie,
  readSafeReturnTo,
  serializeExpiredNamedCookie,
  serializeNamedCookie,
} from "./auth-http.js";
import {
  createSessionCookieValue,
  readSessionCookieValue,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  sessionCookieName,
} from "./session.js";
import { renderDashboard, renderLoginPage } from "./templates/auth.js";

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
  let oidcProviderMetadata: Promise<OidcProviderMetadata> | null = null;

  function getOidcProviderMetadata(oidcConfig: OidcRuntimeConfig): Promise<OidcProviderMetadata> {
    oidcProviderMetadata ??= discoverOidcProvider(oidcConfig);

    return oidcProviderMetadata;
  }

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

    if (path.startsWith("/assets/")) {
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
    const provider = await getOidcProviderMetadata(config.oidc);
    reply.header("Set-Cookie", serializeNamedCookie(oidcStateCookieName, state, secureCookie));

    return reply.redirect(buildAuthorizationUrl(config.oidc, provider, config.baseUrl, state));
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

    const provider = await getOidcProviderMetadata(config.oidc);
    const oidcUser = await exchangeAuthorizationCode(
      config.oidc,
      provider,
      config.baseUrl,
      query.code,
    );
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
      const provider = await getOidcProviderMetadata(config.oidc);
      return reply.redirect(buildEndSessionUrl(provider, config.baseUrl) ?? "/auth/login");
    }

    return reply.redirect("/auth/login");
  });
}
