import type { FastifyInstance, FastifyRequest } from "fastify";
import type { OidcTransactionService } from "../../core/auth/oidc-transaction-service.js";
import type { SessionService } from "../../core/auth/session-service.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import {
  buildAuthorizationUrl,
  buildEndSessionUrl,
  discoverOidcProvider,
  exchangeAuthorizationCode,
  type OidcProviderMetadata,
  type OidcRuntimeConfig,
} from "../oidc/authentik-oidc.js";
import { getPath, readCallbackQuery, readCookie, readSafeReturnTo } from "./auth-http.js";
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

const publicPaths = new Set(["/health", "/auth/login", "/auth/callback"]);

export function registerAuth(
  server: FastifyInstance,
  config: AuthRuntimeConfig,
  sessions: SessionService,
  oidcTransactions: OidcTransactionService,
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

    if (
      publicPaths.has(path) ||
      (path === "/auth/test-login" && config.mode === "test") ||
      (path === "/auth/logout" && request.method === "POST")
    ) {
      return;
    }

    if (path.startsWith("/assets/")) {
      return;
    }

    if (user === null) {
      return reply.redirect(`/auth/login?returnTo=${encodeURIComponent(request.url)}`);
    }
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
            reply.request.localization.text("auth.missingOidcConfig"),
          ),
        );
    }

    const transaction = await oidcTransactions.create(returnTo);
    const provider = await getOidcProviderMetadata(config.oidc);
    return reply.redirect(
      buildAuthorizationUrl(
        config.oidc,
        provider,
        config.baseUrl,
        transaction.state,
        transaction.nonce,
      ),
    );
  });

  if (config.mode === "test") {
    server.get("/auth/test-login", async (request, reply) => {
      const returnTo = readSafeReturnTo(request.query);
      const session = await sessions.create(testUser);
      reply.header(
        "Set-Cookie",
        serializeSessionCookie(session.token, session.expiresAt, secureCookie),
      );
      return reply.redirect(returnTo);
    });
  }

  server.get("/auth/callback", async (request, reply) => {
    if (config.mode !== "oidc" || config.oidc === null) {
      return reply
        .status(404)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.request.localization.text("auth.notFound"),
          ),
        );
    }

    const query = readCallbackQuery(request.query);
    const transaction = query === null ? null : await oidcTransactions.consume(query.state);
    if (query === null || transaction === null) {
      return reply
        .status(400)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.request.localization.text("auth.invalidCallback"),
          ),
        );
    }

    try {
      const provider = await getOidcProviderMetadata(config.oidc);
      const oidcUser = await exchangeAuthorizationCode(
        config.oidc,
        provider,
        config.baseUrl,
        query.code,
        transaction.nonce,
      );
      const user: UserContext = {
        id: oidcUser.sub,
        displayName: oidcUser.name,
        email: oidcUser.email,
      };
      const session = await sessions.create(user);
      reply.header(
        "Set-Cookie",
        serializeSessionCookie(session.token, session.expiresAt, secureCookie),
      );
      return reply.redirect(transaction.returnTo);
    } catch {
      return reply
        .status(400)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.request.localization.text("auth.invalidCallback"),
          ),
        );
    }
  });

  server.post("/auth/logout", async (request, reply) => {
    if (!hasSameOrigin(request.headers.origin, config.baseUrl)) {
      return reply
        .status(403)
        .type("text/html; charset=utf-8")
        .send(
          await createFamilyFlowViews(reply).authErrorPage(
            reply.request.localization.text("auth.invalidLogoutOrigin"),
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
            reply.request.localization.text("auth.invalidSession"),
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
