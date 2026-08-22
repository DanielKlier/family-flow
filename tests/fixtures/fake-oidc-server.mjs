import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";

const port = Number(process.env.PORT ?? "8080");
const issuer = process.env.ISSUER_URL ?? `https://oidc:${port}`;
const privateKey = readFileSync("/app/tls/oidc.key");
const publicJwk = createPrivateKey(privateKey).export({ format: "jwk" });
const keyId = "synthetic-oidc-key";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function idToken(nonce) {
  const header = encode({ alg: "RS256", kid: keyId, typ: "JWT" });
  const claims = encode({
    iss: issuer,
    aud: "smoke-client",
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce,
    sub: "synthetic-user",
    name: "Synthetic User",
    email: "synthetic@example.test",
  });
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), privateKey).toString(
    "base64url",
  );
  return `${header}.${claims}.${signature}`;
}

const server = createServer(
  {
    cert: readFileSync("/app/tls/oidc.crt"),
    key: privateKey,
  },
  async (request, response) => {
    const url = new URL(request.url ?? "/", issuer);
    if (url.pathname === "/.well-known/openid-configuration") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/jwks`,
          end_session_endpoint: `${issuer}/logout`,
        }),
      );
      return;
    }
    if (url.pathname === "/token") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const nonce = new URLSearchParams(body).get("code") ?? "";
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ access_token: "synthetic-access-token", id_token: idToken(nonce) }),
      );
      return;
    }
    if (url.pathname === "/jwks") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ keys: [{ ...publicJwk, kid: keyId, alg: "RS256", use: "sig" }] }),
      );
      return;
    }
    response.writeHead(204);
    response.end();
  },
);

server.listen(port, "0.0.0.0");
