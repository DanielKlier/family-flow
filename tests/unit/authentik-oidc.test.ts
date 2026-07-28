import { describe, expect, it } from "vitest";

import { buildAuthorizationUrl } from "../../src/adapters/oidc/authentik-oidc.js";

describe("Authentik OIDC URLs", () => {
  it("builds the authorization endpoint outside the provider slug path", () => {
    const url = new URL(
      buildAuthorizationUrl(
        {
          issuerUrl: "https://auth.home.arpa/application/o/family-flow",
          clientId: "family-flow-client",
          clientSecret: "secret",
        },
        "https://finances.home.arpa",
        "state-value",
      ),
    );

    expect(url.origin + url.pathname).toBe("https://auth.home.arpa/application/o/authorize/");
    expect(url.searchParams.get("redirect_uri")).toBe("https://finances.home.arpa/auth/callback");
    expect(url.searchParams.get("client_id")).toBe("family-flow-client");
    expect(url.searchParams.get("state")).toBe("state-value");
  });
});
