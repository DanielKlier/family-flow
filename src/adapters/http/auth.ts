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
import type { SessionService } from "../../core/auth/session-service.js";
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
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  sessionCookieName,
} from "./session.js";
import { createFamilyFlowViews } from "./views.js";

export type AuthRuntimeConfig = {
  mode: "test" | "oidc";
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

const publicPaths = new Set(["/health", "/auth/login", "/auth/callback", "/auth/test-login"]);
const oidcStateCookieName = "ff_oidc_state";

export function registerAuth(
  server: FastifyInstance,
  config: AuthRuntimeConfig,
  sessions: SessionService,
): void {
  const secureCookie = config.baseUrl.startsWith("https://");
  let oidcProviderMetadata: Promise<OidcProviderMetadata> | null = null;

  function getOidcProviderMetadata(oidcConfig: OidcRuntimeConfig): Promise<OidcProviderMetadata> {
    oidcProviderMetadata ??= discoverOidcProvider(oidcConfig);

    return oidcProviderMetadata;
  }

  server.addHook("preHandler", async (request: RequestWithUser, reply) => {
    const path = getPath(request.url);
    const user = await sessions.lookup(readCookie(request.headers.cookie, sessionCookieName));
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
    const views = createFamilyFlowViews(reply);
    if (user === undefined) {
      return reply
        .status(500)
        .type("text/html; charset=utf-8")
        .send(await views.authErrorPage(reply.server.localization.text("auth.missingUserContext")));
    }

    return reply.type("text/html; charset=utf-8").send(await views.dashboardPage(user));
  });

  server.get("/auth/login", async (request, reply) => {
    const returnTo = readSafeReturnTo(request.query);
    if (config.mode === "test") {
      return reply
        .type("text/html; charset=utf-8")
        .send(await createFamilyFlowViews(reply).authLoginPage(returnTo));
    }

    if (config.oidc === null) {
      return reply
        .status(500)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.server.localization.text("auth.missingOidcConfig"),
          ),
        );
    }

    const state = randomUUID();
    const provider = await getOidcProviderMetadata(config.oidc);
    reply.header("Set-Cookie", serializeNamedCookie(oidcStateCookieName, state, secureCookie));

    return reply.redirect(buildAuthorizationUrl(config.oidc, provider, config.baseUrl, state));
  });

  server.get("/auth/test-login", async (request, reply) => {
    if (config.mode !== "test") {
      return reply
        .status(404)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.server.localization.text("auth.notFound"),
          ),
        );
    }

    const returnTo = readSafeReturnTo(request.query);
    const session = await sessions.create(testUser);
    reply.header(
      "Set-Cookie",
      serializeSessionCookie(session.token, session.expiresAt, secureCookie),
    );

    return reply.redirect(returnTo);
  });

  server.get("/auth/callback", async (request, reply) => {
    if (config.mode !== "oidc" || config.oidc === null) {
      return reply
        .status(404)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.server.localization.text("auth.notFound"),
          ),
        );
    }

    const query = readCallbackQuery(request.query);
    const expectedState = readCookie(request.headers.cookie, oidcStateCookieName);
    if (query === null || expectedState === undefined || query.state !== expectedState) {
      return reply
        .status(400)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.server.localization.text("auth.invalidCallback"),
          ),
        );
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
    const session = await sessions.create(user);
    reply.header("Set-Cookie", [
      serializeSessionCookie(session.token, session.expiresAt, secureCookie),
      serializeExpiredNamedCookie(oidcStateCookieName, secureCookie),
    ]);

    return reply.redirect("/");
  });

  server.post("/auth/logout", async (request, reply) => {
    if (!hasSameOrigin(request.headers.origin, config.baseUrl)) {
      return reply
        .status(403)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.server.localization.text("auth.invalidLogoutOrigin"),
          ),
        );
    }

    const token = readCookie(request.headers.cookie, sessionCookieName);
    if (!(await sessions.revoke(token))) {
      return reply
        .status(401)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.server.localization.text("auth.invalidSession"),
          ),
        );
    }
    reply.header("Set-Cookie", serializeExpiredSessionCookie(secureCookie));

    if (config.mode === "oidc" && config.oidc !== null) {
      const provider = await getOidcProviderMetadata(config.oidc);
      return reply.redirect(buildEndSessionUrl(provider, config.baseUrl) ?? "/auth/login");
    }

    return reply.redirect("/auth/login");
  });
}

function hasSameOrigin(origin: string | undefined, baseUrl: string): boolean {
  if (origin === undefined) return false;
  try {
    return new URL(origin).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}
