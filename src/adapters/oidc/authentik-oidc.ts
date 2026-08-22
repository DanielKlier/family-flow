import { createPublicKey, type JsonWebKey, verify } from "node:crypto";

import { readJsonObject } from "./json.js";

export type OidcRuntimeConfig = {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
};

export type OidcProviderMetadata = {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  jwksUri: string;
  endSessionEndpoint: string | null;
};

export type OidcUserInfo = { sub: string; name: string; email: string };

type FetchProvider = (input: URL | string, init?: RequestInit) => Promise<Response>;

export async function discoverOidcProvider(
  config: OidcRuntimeConfig,
  fetchProvider: FetchProvider = fetch,
): Promise<OidcProviderMetadata> {
  const discoveryUrl = new URL(".well-known/openid-configuration", `${config.issuerUrl}/`);
  const response = await fetchProvider(discoveryUrl);
  if (!response.ok) throw new Error("OIDC discovery request failed");

  const metadata = await readJsonObject(response, "OIDC discovery response was invalid");
  if (metadata.issuer !== config.issuerUrl) {
    throw new Error("OIDC discovery issuer did not match configured issuer");
  }

  return {
    authorizationEndpoint: readEndpoint(metadata, "authorization_endpoint"),
    tokenEndpoint: readEndpoint(metadata, "token_endpoint"),
    userinfoEndpoint: readEndpoint(metadata, "userinfo_endpoint"),
    jwksUri: readEndpoint(metadata, "jwks_uri"),
    endSessionEndpoint: readOptionalEndpoint(metadata, "end_session_endpoint"),
  };
}

export function buildAuthorizationUrl(
  config: Pick<OidcRuntimeConfig, "clientId">,
  provider: OidcProviderMetadata,
  baseUrl: string,
  state: string,
  nonce: string,
): string {
  const url = new URL(provider.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  return url.toString();
}

export function buildEndSessionUrl(provider: OidcProviderMetadata, baseUrl: string): string | null {
  if (provider.endSessionEndpoint === null) return null;
  const url = new URL(provider.endSessionEndpoint);
  url.searchParams.set("post_logout_redirect_uri", `${baseUrl}/auth/login`);
  return url.toString();
}

export async function exchangeAuthorizationCode(
  config: OidcRuntimeConfig,
  provider: OidcProviderMetadata,
  baseUrl: string,
  code: string,
  expectedNonce: string,
  fetchProvider: FetchProvider = fetch,
): Promise<OidcUserInfo> {
  const tokenResponse = await fetchProvider(provider.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${baseUrl}/auth/callback`,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  if (!tokenResponse.ok) throw new Error("OIDC token exchange failed");

  const tokenPayload = await readJsonObject(tokenResponse, "OIDC token response was invalid");
  if (typeof tokenPayload.id_token !== "string" || tokenPayload.id_token === "") {
    throw new Error("OIDC token response did not include an ID token");
  }
  return validateIdToken(tokenPayload.id_token, config, provider, expectedNonce, fetchProvider);
}

async function validateIdToken(
  token: string,
  config: OidcRuntimeConfig,
  provider: OidcProviderMetadata,
  expectedNonce: string,
  fetchProvider: FetchProvider,
): Promise<OidcUserInfo> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("OIDC ID token was invalid");
  const [encodedHeader = "", encodedClaims = "", encodedSignature = ""] = parts;
  const header = readJwtPart(encodedHeader);
  const claims = readJwtPart(encodedClaims);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid === "") {
    throw new Error("OIDC ID token header was invalid");
  }

  const jwksResponse = await fetchProvider(provider.jwksUri);
  if (!jwksResponse.ok) throw new Error("OIDC JWKS request failed");
  const jwks = await readJsonObject(jwksResponse, "OIDC JWKS response was invalid");
  const key = readSigningKey(jwks.keys, header.kid);
  const validSignature = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    createPublicKey({ key, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!validSignature) throw new Error("OIDC ID token signature was invalid");

  const nowSeconds = Math.floor(Date.now() / 1_000);
  if (
    claims.iss !== config.issuerUrl ||
    !hasAudience(claims.aud, claims.azp, config.clientId) ||
    typeof claims.exp !== "number" ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= nowSeconds ||
    claims.nonce !== expectedNonce
  ) {
    throw new Error("OIDC ID token claims were invalid");
  }

  return {
    sub: requiredClaim(claims, "sub"),
    name: requiredClaim(claims, "name"),
    email: requiredClaim(claims, "email"),
  };
}

function readJwtPart(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("OIDC ID token was invalid");
  }
}

function readSigningKey(value: unknown, kid: string): JsonWebKey {
  if (!Array.isArray(value)) throw new Error("OIDC JWKS response did not include keys");
  const key = value.find(
    (candidate): candidate is Record<string, unknown> =>
      typeof candidate === "object" && candidate !== null && Reflect.get(candidate, "kid") === kid,
  );
  if (
    key === undefined ||
    key.kty !== "RSA" ||
    typeof key.n !== "string" ||
    typeof key.e !== "string"
  ) {
    throw new Error("OIDC signing key was not found");
  }
  return { kty: "RSA", n: key.n, e: key.e };
}

function hasAudience(value: unknown, authorizedParty: unknown, clientId: string): boolean {
  if (value === clientId) return true;
  if (!Array.isArray(value) || !value.every((audience) => typeof audience === "string"))
    return false;
  if (!value.includes(clientId)) return false;
  return value.length === 1 || authorizedParty === clientId;
}

function requiredClaim(claims: Record<string, unknown>, key: "sub" | "name" | "email"): string {
  const value = claims[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`OIDC ID token did not include ${key}`);
  }
  return value;
}

function readEndpoint(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`OIDC discovery response did not include ${key}`);
  }
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`OIDC discovery response included invalid ${key}`);
  }
}

function readOptionalEndpoint(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  if (value === undefined) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`OIDC discovery response included invalid ${key}`);
  }
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`OIDC discovery response included invalid ${key}`);
  }
}
