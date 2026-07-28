export type OidcRuntimeConfig = {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
};

export type OidcUserInfo = {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
};

export function buildAuthorizationUrl(
  config: OidcRuntimeConfig,
  baseUrl: string,
  state: string,
): string {
  const url = new URL("authorize/", getOauthEndpointBaseUrl(config));
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export function buildEndSessionUrl(config: OidcRuntimeConfig, baseUrl: string): string {
  const url = new URL("end-session/", `${config.issuerUrl}/`);
  url.searchParams.set("post_logout_redirect_uri", `${baseUrl}/auth/login`);

  return url.toString();
}

export async function exchangeAuthorizationCode(
  config: OidcRuntimeConfig,
  baseUrl: string,
  code: string,
): Promise<OidcUserInfo> {
  const tokenResponse = await fetch(new URL("token/", getOauthEndpointBaseUrl(config)), {
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

  const tokenPayload = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof tokenPayload.access_token !== "string") {
    throw new Error("OIDC token response did not include an access token");
  }

  const userInfoResponse = await fetch(new URL("userinfo/", getOauthEndpointBaseUrl(config)), {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    throw new Error("OIDC userinfo request failed");
  }

  const userInfo = (await userInfoResponse.json()) as Partial<OidcUserInfo>;
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

function getOauthEndpointBaseUrl(config: OidcRuntimeConfig): URL {
  const issuerUrl = new URL(`${config.issuerUrl}/`);
  const pathSegments = issuerUrl.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 0) {
    return issuerUrl;
  }

  issuerUrl.pathname = `/${pathSegments.slice(0, -1).join("/")}/`;

  return issuerUrl;
}
