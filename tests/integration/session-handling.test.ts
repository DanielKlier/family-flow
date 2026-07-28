import { describe, expect, it } from "vitest";

import { buildServer } from "../../src/app/server.js";

describe("session handling", () => {
  it("creates a signed session cookie for the local test login", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/auth/test-login?returnTo=/",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/");
    expect(response.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ff_session",
          httpOnly: true,
          sameSite: "Lax",
        }),
      ]),
    );

    await server.close();
  });

  it("clears the session cookie on logout", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/auth/logout",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/auth/login");
    expect(response.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ff_session",
          value: "",
          maxAge: 0,
        }),
      ]),
    );

    await server.close();
  });
});
