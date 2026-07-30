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
  endSessionEndpoint: string | null;
};

export type OidcUserInfo = {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
};

type FetchProvider = (input: URL | string, init?: RequestInit) => Promise<Response>;

export async function discoverOidcProvider(
  config: OidcRuntimeConfig,
  fetchProvider: FetchProvider = fetch,
): Promise<OidcProviderMetadata> {
  const discoveryUrl = new URL(".well-known/openid-configuration", `${config.issuerUrl}/`);
  const response = await fetchProvider(discoveryUrl);

  if (!response.ok) {
    throw new Error("OIDC discovery request failed");
  }

  const metadata = await readJsonObject(response, "OIDC discovery response was invalid");

  return {
    authorizationEndpoint: readEndpoint(metadata, "authorization_endpoint"),
    tokenEndpoint: readEndpoint(metadata, "token_endpoint"),
    userinfoEndpoint: readEndpoint(metadata, "userinfo_endpoint"),
    endSessionEndpoint: readOptionalEndpoint(metadata, "end_session_endpoint"),
  };
}

export function buildAuthorizationUrl(
  config: Pick<OidcRuntimeConfig, "clientId">,
  provider: OidcProviderMetadata,
  baseUrl: string,
  state: string,
): string {
  const url = new URL(provider.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export function buildEndSessionUrl(provider: OidcProviderMetadata, baseUrl: string): string | null {
  if (provider.endSessionEndpoint === null) {
    return null;
  }

  const url = new URL(provider.endSessionEndpoint);
  url.searchParams.set("post_logout_redirect_uri", `${baseUrl}/auth/login`);

  return url.toString();
}

export async function exchangeAuthorizationCode(
  config: OidcRuntimeConfig,
  provider: OidcProviderMetadata,
  baseUrl: string,
  code: string,
  fetchProvider: FetchProvider = fetch,
): Promise<OidcUserInfo> {
  const tokenResponse = await fetchProvider(provider.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${baseUrl}/auth/callback`,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("OIDC token exchange failed");
  }

  const tokenPayload = await readJsonObject(tokenResponse, "OIDC token response was invalid");
  if (typeof tokenPayload.access_token !== "string") {
    throw new Error("OIDC token response did not include an access token");
  }

  const userInfoResponse = await fetchProvider(provider.userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    throw new Error("OIDC userinfo request failed");
  }

  const userInfo = await readJsonObject(userInfoResponse, "OIDC userinfo response was invalid");
  if (typeof userInfo.sub !== "string") {
    throw new Error("OIDC userinfo response did not include a subject");
  }

  return {
    sub: userInfo.sub,
    name: typeof userInfo.name === "string" ? userInfo.name : undefined,
    preferred_username:
      typeof userInfo.preferred_username === "string" ? userInfo.preferred_username : undefined,
    email: typeof userInfo.email === "string" ? userInfo.email : undefined,
  };
}

function readEndpoint(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`OIDC discovery response did not include ${key}`);
  }

  return value;
}

function readOptionalEndpoint(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`OIDC discovery response included invalid ${key}`);
  }

  return value;
}
