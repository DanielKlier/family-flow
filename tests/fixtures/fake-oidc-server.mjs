import { createServer } from "node:http";

const port = Number(process.env.PORT ?? "8080");
const issuer = process.env.ISSUER_URL ?? `http://oidc:${port}`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", issuer);
  if (url.pathname === "/.well-known/openid-configuration") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        end_session_endpoint: `${issuer}/logout`,
      }),
    );
    return;
  }
  if (url.pathname === "/token") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ access_token: "synthetic-access-token" }));
    return;
  }
  if (url.pathname === "/userinfo") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ sub: "synthetic-user", name: "Synthetic User" }));
    return;
  }
  response.writeHead(204);
  response.end();
});

server.listen(port, "0.0.0.0");
