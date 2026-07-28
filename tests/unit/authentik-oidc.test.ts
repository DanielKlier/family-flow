import { describe, expect, it, vi } from "vitest";

import {
  buildAuthorizationUrl,
  discoverOidcProvider,
} from "../../src/adapters/oidc/authentik-oidc.js";

describe("OIDC discovery", () => {
  it("loads provider endpoints from the issuer well-known configuration", async () => {
    const fetchProvider = vi.fn(async () =>
      Response.json({
        issuer: "https://auth.home.arpa/application/o/family-flow/",
        authorization_endpoint: "https://auth.home.arpa/application/o/authorize/",
        token_endpoint: "https://auth.home.arpa/application/o/token/",
        userinfo_endpoint: "https://auth.home.arpa/application/o/userinfo/",
        end_session_endpoint: "https://auth.home.arpa/application/o/family-flow/end-session/",
      }),
    );

    const provider = await discoverOidcProvider(
      {
        issuerUrl: "https://auth.home.arpa/application/o/family-flow",
        clientId: "family-flow-client",
        clientSecret: "secret",
      },
      fetchProvider,
    );

    expect(fetchProvider).toHaveBeenCalledWith(
      new URL("https://auth.home.arpa/application/o/family-flow/.well-known/openid-configuration"),
    );
    expect(provider).toEqual({
      authorizationEndpoint: "https://auth.home.arpa/application/o/authorize/",
      tokenEndpoint: "https://auth.home.arpa/application/o/token/",
      userinfoEndpoint: "https://auth.home.arpa/application/o/userinfo/",
      endSessionEndpoint: "https://auth.home.arpa/application/o/family-flow/end-session/",
    });
  });

  it("builds the authorization URL from discovered metadata", () => {
    const url = new URL(
      buildAuthorizationUrl(
        {
          clientId: "family-flow-client",
        },
        {
          authorizationEndpoint: "https://auth.home.arpa/custom/authorize/",
          tokenEndpoint: "https://auth.home.arpa/custom/token/",
          userinfoEndpoint: "https://auth.home.arpa/custom/userinfo/",
          endSessionEndpoint: "https://auth.home.arpa/custom/end-session/",
        },
        "https://finances.home.arpa",
        "state-value",
      ),
    );

    expect(url.origin + url.pathname).toBe("https://auth.home.arpa/custom/authorize/");
    expect(url.searchParams.get("redirect_uri")).toBe("https://finances.home.arpa/auth/callback");
    expect(url.searchParams.get("client_id")).toBe("family-flow-client");
    expect(url.searchParams.get("state")).toBe("state-value");
  });
});
