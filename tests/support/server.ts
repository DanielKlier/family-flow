import type { buildServer } from "../../src/app/server.js";

export async function listen(server: ReturnType<typeof buildServer>): Promise<string> {
  await server.listen({ host: "127.0.0.1", port: 0 });

  const address = server.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the test server to listen on a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}
