import { generateKeyPairSync, sign } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  buildAuthorizationUrl,
  discoverOidcProvider,
  exchangeAuthorizationCode,
} from "../../src/adapters/oidc/authentik-oidc.js";

describe("OIDC discovery", () => {
  it("loads provider endpoints from the issuer well-known configuration", async () => {
    const fetchProvider = vi.fn(async () =>
      Response.json({
        issuer: "https://auth.home.arpa/application/o/family-flow",
        jwks_uri: "https://auth.home.arpa/application/o/family-flow/jwks/",
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
      jwksUri: "https://auth.home.arpa/application/o/family-flow/jwks/",
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
          jwksUri: "https://auth.home.arpa/custom/jwks/",
          endSessionEndpoint: "https://auth.home.arpa/custom/end-session/",
        },
        "https://finances.home.arpa",
        "state-value",
        "nonce-value",
      ),
    );

    expect(url.origin + url.pathname).toBe("https://auth.home.arpa/custom/authorize/");
    expect(url.searchParams.get("redirect_uri")).toBe("https://finances.home.arpa/auth/callback");
    expect(url.searchParams.get("client_id")).toBe("family-flow-client");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("nonce")).toBe("nonce-value");
  });

  it.each([
    ["a mismatched issuer", { issuer: "https://other.example.invalid/issuer" }],
    ["a missing JWKS endpoint", { jwks_uri: undefined }],
  ])("rejects discovery metadata with %s", async (_description, metadataOverride) => {
    const fetchProvider = vi.fn(async () =>
      Response.json({
        issuer: "https://auth.home.arpa/application/o/family-flow",
        authorization_endpoint: "https://auth.home.arpa/application/o/authorize/",
        token_endpoint: "https://auth.home.arpa/application/o/token/",
        userinfo_endpoint: "https://auth.home.arpa/application/o/userinfo/",
        jwks_uri: "https://auth.home.arpa/application/o/family-flow/jwks/",
        ...metadataOverride,
      }),
    );

    await expect(
      discoverOidcProvider(
        {
          issuerUrl: "https://auth.home.arpa/application/o/family-flow",
          clientId: "family-flow-client",
          clientSecret: "secret",
        },
        fetchProvider,
      ),
    ).rejects.toThrow();
  });
});

describe("OIDC ID tokens", () => {
  const issuer = "https://issuer.example.invalid/family-flow";
  const provider = {
    authorizationEndpoint: `${issuer}/authorize`,
    tokenEndpoint: `${issuer}/token`,
    userinfoEndpoint: `${issuer}/userinfo`,
    jwksUri: `${issuer}/jwks`,
    endSessionEndpoint: null,
  };
  const config = { issuerUrl: issuer, clientId: "family-flow", clientSecret: "secret" };

  it.each([
    ["issuer", { iss: "https://attacker.example.invalid" }],
    ["audience", { aud: "another-client" }],
    ["expiry", { exp: 1 }],
    ["nonce", { nonce: "another-nonce" }],
    ["subject", { sub: " " }],
    ["name", { name: "" }],
    ["email", { email: "" }],
  ])("rejects an invalid %s claim", async (_description, override) => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = signedToken(privateKey, {
      iss: issuer,
      aud: "family-flow",
      exp: Math.floor(Date.now() / 1_000) + 60,
      nonce: "expected-nonce",
      sub: "subject",
      name: "User Name",
      email: "user@example.invalid",
      ...override,
    });
    const jwk = publicKey.export({ format: "jwk" });
    const fetchProvider = async (input: URL | string) =>
      String(input) === provider.tokenEndpoint
        ? Response.json({ id_token: token })
        : Response.json({ keys: [{ ...jwk, kid: "test-key" }] });

    await expect(
      exchangeAuthorizationCode(
        config,
        provider,
        "https://finances.home.arpa",
        "code",
        "expected-nonce",
        fetchProvider,
      ),
    ).rejects.toThrow();
  });

  it("rejects an ID token with an invalid signature", async () => {
    const signer = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const verifier = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = signedToken(signer.privateKey, {
      iss: issuer,
      aud: "family-flow",
      exp: Math.floor(Date.now() / 1_000) + 60,
      nonce: "expected-nonce",
      sub: "subject",
      name: "User Name",
      email: "user@example.invalid",
    });
    const jwk = verifier.publicKey.export({ format: "jwk" });
    const fetchProvider = async (input: URL | string) =>
      String(input) === provider.tokenEndpoint
        ? Response.json({ id_token: token })
        : Response.json({ keys: [{ ...jwk, kid: "test-key" }] });

    await expect(
      exchangeAuthorizationCode(
        config,
        provider,
        "https://finances.home.arpa",
        "code",
        "expected-nonce",
        fetchProvider,
      ),
    ).rejects.toThrow();
  });
});

function signedToken(
  privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"],
  claims: Record<string, unknown>,
): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString(
    "base64url",
  );
  return `${header}.${payload}.${signature}`;
}
