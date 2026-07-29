import type { FastifyInstance } from "fastify";

export function registerFormParser(server: FastifyInstance): void {
  server.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body.toString())));
    },
  );
}
