import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories } from "../../src/adapters/db/default-repositories.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";

const germanHeaders = { "accept-language": "de-AT,de;q=0.9,en;q=0.8" };
const englishHeaders = { "accept-language": "en-GB,en;q=0.9" };

async function authenticatedHeaders(
  server: ReturnType<typeof buildServer>,
  headers: Record<string, string>,
) {
  const login = await server.inject({ method: "GET", url: "/auth/test-login", headers });
  const session = login.cookies.find(({ name }) => name === "ff_session");
  if (session === undefined) throw new Error("Test login must establish a session");
  return { ...headers, cookie: `ff_session=${session.value}` };
}

function expectLocalizedHtml(
  response: { headers: Record<string, string | string[] | undefined> },
  locale: string,
) {
  expect(response.headers["content-language"]).toBe(locale);
  expect(response.headers.vary).toContain("Accept-Language");
}

describe("request-scoped HTTP localization", () => {
  it("INT-FF-LOC-005-01: isolates negotiated full pages and form parsing on one server", async () => {
    const repositories = createSeededInMemoryRepositories(createGermanLocalization());
    const server = buildServer({ repositories });

    try {
      const german = await authenticatedHeaders(server, germanHeaders);
      const english = await authenticatedHeaders(server, englishHeaders);
      const germanPage = await server.inject({
        method: "GET",
        url: "/transactions",
        headers: german,
      });
      const englishPage = await server.inject({
        method: "GET",
        url: "/transactions",
        headers: english,
      });

      expectLocalizedHtml(germanPage, "de-DE");
      expect(germanPage.body).toContain('<html lang="de-DE">');
      expect(germanPage.body).toContain("Transaktionen");
      expectLocalizedHtml(englishPage, "en");
      expect(englishPage.body).toContain('<html lang="en">');
      expect(englishPage.body).toContain("Transactions");
      expect(englishPage.body).toContain("Amount");
      expect(englishPage.body).toContain("Date");

      const englishCreate = await server.inject({
        method: "POST",
        url: "/transactions",
        headers: english,
        payload: {
          accountId: "account-person-a-checking",
          categoryId: "category-other",
          description: "English grammar",
          amount: "1,234.56",
          date: "12/31/2026",
          status: "booked",
        },
      });
      expect(englishCreate.statusCode).toBe(302);
      await expect(repositories.transactions.list({})).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: "English grammar",
            amountCents: -123456,
            date: "2026-12-31",
          }),
        ]),
      );
    } finally {
      await server.close();
    }
  });

  it("INT-FF-LOC-005-02: labels HTMX and rendered errors as locale-varying representations", async () => {
    const server = buildServer();
    server.get("/test/locale-error", () => {
      throw new Error("Test-only unexpected error");
    });

    try {
      const english = await authenticatedHeaders(server, englishHeaders);
      const htmx = await server.inject({
        method: "GET",
        url: "/transactions",
        headers: { ...english, "hx-request": "true" },
      });
      expectLocalizedHtml(htmx, "en");
      expect(htmx.body).toContain("Transactions");

      const invalid = await server.inject({
        method: "POST",
        url: "/transactions",
        headers: { ...english, "x-request-id": "english-invalid-transaction" },
        payload: { description: "Broken", amount: "not-a-number", date: "12/31/2026" },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.headers["x-request-id"]).toBe("english-invalid-transaction");
      expectLocalizedHtml(invalid, "en");
      expect(invalid.body).toContain("The transaction could not be saved.");

      const unauthorized = await server.inject({
        method: "POST",
        url: "/auth/logout",
        headers: {
          ...englishHeaders,
          origin: "http://127.0.0.1:3000",
          cookie: "ff_session=unknown",
          "x-request-id": "english-unauthorized",
        },
      });
      expect(unauthorized.statusCode).toBe(401);
      expect(unauthorized.headers["x-request-id"]).toBe("english-unauthorized");
      expectLocalizedHtml(unauthorized, "en");
      expect(unauthorized.body).toContain("Invalid session.");

      const missing = await server.inject({
        method: "GET",
        url: "/missing",
        headers: english,
      });
      expect(missing.statusCode).toBe(404);
      expectLocalizedHtml(missing, "en");
      expect(missing.body).toContain("Page not found");

      const unexpected = await server.inject({
        method: "GET",
        url: "/test/locale-error",
        headers: { ...english, "x-request-id": "english-unexpected" },
      });
      expect(unexpected.statusCode).toBe(500);
      expect(unexpected.headers["x-request-id"]).toBe("english-unexpected");
      expectLocalizedHtml(unexpected, "en");
      expect(unexpected.body).toContain("Internal server error");
    } finally {
      await server.close();
    }
  });

  it("INT-FF-LOC-005-03: leaves redirects and health independent of locale", async () => {
    const server = buildServer();

    try {
      const redirect = await server.inject({
        method: "GET",
        url: "/transactions",
        headers: { ...englishHeaders, "x-request-id": "english-redirect" },
      });
      expect(redirect.statusCode).toBe(302);
      expect(redirect.headers["x-request-id"]).toBe("english-redirect");
      expect(redirect.headers["content-language"]).toBeUndefined();
      expect(redirect.headers.vary ?? "").not.toContain("Accept-Language");

      const health = await server.inject({
        method: "GET",
        url: "/health",
        headers: englishHeaders,
      });
      expect(health.headers["content-language"]).toBeUndefined();
      expect(health.headers.vary ?? "").not.toContain("Accept-Language");
    } finally {
      await server.close();
    }
  });
});
