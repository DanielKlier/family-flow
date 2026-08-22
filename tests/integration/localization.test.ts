import { describe, expect, it } from "vitest";

import { createSeededInMemoryRepositories as createRepositories } from "../../src/adapters/db/default-repositories.js";
import { readTransactionFilters } from "../../src/adapters/http/transaction-request.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";
import { buildServer } from "../../src/app/server.js";
import type { RequestLogEntry, RequestLogger } from "../../src/ports/logging/logger.js";

function createSeededInMemoryRepositories() {
  return createRepositories(createGermanLocalization());
}

class CapturingLogger implements RequestLogger {
  entries: RequestLogEntry[] = [];

  logRequest(entry: RequestLogEntry): void {
    this.entries.push(entry);
  }
}

async function authenticatedHeaders(server: ReturnType<typeof buildServer>) {
  const login = await server.inject({ method: "GET", url: "/auth/test-login" });
  const session = login.cookies.find(({ name }) => name === "ff_session");
  if (session === undefined) throw new Error("Test login must establish a session");
  return { cookie: `ff_session=${session.value}` };
}

describe("German localization HTTP adapter", () => {
  it.each([
    [
      "404",
      "/missing-localized-page",
      "Seite nicht gefunden",
      "Die angeforderte Seite wurde nicht gefunden.",
    ],
    [
      "500",
      "/unexpected-localized-error",
      "Interner Serverfehler",
      "Ein unerwarteter Fehler ist aufgetreten.",
    ],
  ])(
    "INT-FF-LOC-001-05 renders the authenticated %s page in German with its request ID and exactly one log",
    async (status, path, heading, message) => {
      const logger = new CapturingLogger();
      const server = buildServer({ logger });
      server.get("/unexpected-localized-error", async () => {
        throw new Error("representative unexpected failure");
      });

      try {
        const headers = await authenticatedHeaders(server);
        logger.entries = [];
        const requestId =
          status === "404"
            ? "10000000-0000-4000-8000-000000000006"
            : "10000000-0000-4000-8000-000000000007";
        const response = await server.inject({
          method: "GET",
          url: path,
          headers: { ...headers, "x-request-id": requestId },
        });

        expect(response.statusCode).toBe(Number(status));
        expect(response.headers["content-type"]).toContain("text/html");
        expect(response.headers["x-request-id"]).toBe(requestId);
        expect(response.body).toContain(heading);
        expect(response.body).toContain(message);
        expect(response.body).toContain("Anfrage-ID:");
        expect(response.body).toContain(requestId);
        expect(logger.entries).toHaveLength(1);
        expect(logger.entries[0]).toMatchObject({
          requestId,
          path,
          statusCode: Number(status),
          user: "test-user",
          outcome: "error",
        });
      } finally {
        await server.close();
      }
    },
  );

  it("INT-FF-LOC-001-04 renders the existing surface inventory without known English UI literals", async () => {
    const server = buildServer();

    try {
      const headers = await authenticatedHeaders(server);
      for (const path of [
        "/",
        "/admin/master-data",
        "/transactions",
        "/imports/csv",
        "/categorization-rules",
        "/income",
      ]) {
        const response = await server.inject({ method: "GET", url: path, headers });
        expect(response.statusCode).toBe(200);
        expect(response.body).not.toMatch(
          />\s*(?:Master Data|Transactions|Income Planning|Categorization Rules|Add transaction|Apply filters|No transactions found)\s*</,
        );
      }
    } finally {
      await server.close();
    }
  });

  it("provides localized names without owning stable master-data inventory", () => {
    const localization = createGermanLocalization();

    expect(localization.seedName("ownerContext", "shared")).toBe("Gemeinsam");
    expect(localization.seedName("account", "account-person-a-checking")).toBe(
      "Girokonto Person A",
    );
    expect(localization.seedName("category", "category-other")).toBe("Sonstiges");
  });

  it("INT-FF-LOC-002-03 covers the finite valid amount, date, month, leap-date, and zero grammar", () => {
    const localization = createGermanLocalization();
    for (const [input, expected] of [
      ["1234", 123400],
      ["1234,5", 123450],
      ["1.234,56", 123456],
      ["1.234.567,89", 123456789],
    ] as const) {
      expect(localization.parseAmountCents(input, false)).toBe(expected);
    }

    expect(localization.parseAmountCents("0", true)).toBe(0);
    expect(() => localization.parseAmountCents("0", false)).toThrow("invalid_amount");
    expect(localization.parseDate("31.12.2026")).toBe("2026-12-31");
    expect(localization.parseDate("29.02.2024")).toBe("2024-02-29");
    expect(localization.parseMonth("02.2026")).toBe("2026-02");
    expect(readTransactionFilters({ month: "02.2026" }, createGermanLocalization())).toEqual({
      month: "2026-02",
    });
  });

  it.each([
    ["signed amount", "amount", "-1"],
    ["spaced amount", "amount", " 1"],
    ["currency amount", "amount", "1 €"],
    ["exponent amount", "amount", "1e3"],
    ["dot-decimal amount", "amount", "1.23"],
    ["malformed grouping", "amount", "12.34,56"],
    ["excess precision", "amount", "1,234"],
    ["unsafe amount", "amount", "900719925474099,99"],
    ["invalid leap date", "date", "29.02.2023"],
    ["invalid calendar date", "date", "31.04.2026"],
    ["malformed date", "date", "1.01.2026"],
    ["month below range", "month", "00.2026"],
    ["month above range", "month", "13.2026"],
    ["malformed month", "month", "2.2026"],
  ])("INT-FF-LOC-002-04 rejects the %s class", (_className, grammar, input) => {
    const localization = createGermanLocalization();
    const parse =
      grammar === "amount"
        ? () => localization.parseAmountCents(input, false)
        : grammar === "date"
          ? () => localization.parseDate(input)
          : () => localization.parseMonth(input);
    expect(parse).toThrow();
  });

  it("INT-FF-LOC-002-05 allows zero for an income override but not recurring income", async () => {
    const repositories = createSeededInMemoryRepositories();
    const server = buildServer({ repositories });

    try {
      const headers = await authenticatedHeaders(server);
      const createPlan = await server.inject({
        method: "POST",
        url: "/income",
        headers,
        payload: {
          ownerContext: "person_a",
          name: "Zero-rule fixture",
          amount: "1000",
          startMonth: "02.2026",
        },
      });
      expect(createPlan.statusCode).toBe(302);
      const plan = (await repositories.income.listPlans({})).find(
        ({ name }) => name === "Zero-rule fixture",
      );
      if (plan === undefined) throw new Error("Income plan fixture must be stored");

      const createOverride = await server.inject({
        method: "POST",
        url: "/income/overrides",
        headers,
        payload: {
          incomePlanId: plan.id,
          month: "02.2026",
          amount: "0",
        },
      });
      expect(createOverride.statusCode).toBe(302);
      await expect(repositories.income.listOverrides({ incomePlanId: plan.id })).resolves.toEqual([
        expect.objectContaining({ month: "2026-02", amountCents: 0 }),
      ]);

      const planCount = (await repositories.income.listPlans({})).length;
      const zeroRecurringIncome = await server.inject({
        method: "POST",
        url: "/income",
        headers,
        payload: {
          ownerContext: "person_a",
          name: "Rejected zero recurring income",
          amount: "0",
          startMonth: "02.2026",
        },
      });
      expect(zeroRecurringIncome.statusCode).toBe(400);
      await expect(repositories.income.listPlans({})).resolves.toHaveLength(planCount);
    } finally {
      await server.close();
    }
  });

  it("INT-FF-LOC-002-01 converts valid German amount and date grammar before calling the core", async () => {
    const repositories = createSeededInMemoryRepositories();
    const server = buildServer({ repositories });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/transactions",
        headers: await authenticatedHeaders(server),
        payload: {
          accountId: "account-person-a-checking",
          categoryId: "category-groceries",
          date: "31.12.2026",
          description: "German HTTP transaction",
          amount: "1.234,56",
          status: "booked",
        },
      });

      expect(response.statusCode).toBe(302);
      await expect(repositories.transactions.list({})).resolves.toContainEqual(
        expect.objectContaining({
          date: "2026-12-31",
          amountCents: -123456,
          description: "German HTTP transaction",
        }),
      );
    } finally {
      await server.close();
    }
  });

  it("INT-FF-LOC-002-02 rejects representative invalid form classes without mutation", async () => {
    const repositories = createSeededInMemoryRepositories();
    const server = buildServer({ repositories });

    try {
      const headers = await authenticatedHeaders(server);
      const existingTransactions = await repositories.transactions.list({});
      for (const [amount, date] of [
        ["-1", "31.12.2026"],
        ["1 €", "31.12.2026"],
        ["1.23", "31.12.2026"],
        ["12.34,56", "31.12.2026"],
        ["1,234", "31.12.2026"],
        ["900719925474099,99", "31.12.2026"],
        ["1", "29.02.2023"],
      ]) {
        const response = await server.inject({
          method: "POST",
          url: "/transactions",
          headers,
          payload: {
            accountId: "account-person-a-checking",
            categoryId: "category-groceries",
            date,
            description: "Rejected German HTTP transaction",
            amount,
            status: "booked",
          },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toMatch(/(Der Betrag|Das Datum) ist ungültig\./);
        await expect(repositories.transactions.list({})).resolves.toEqual(existingTransactions);
      }

      const existingPlans = await repositories.income.listPlans({});
      const invalidMonth = await server.inject({
        method: "POST",
        url: "/income",
        headers,
        payload: {
          ownerContext: "person_a",
          name: "Rejected German income",
          amount: "1000",
          startMonth: "13.2026",
        },
      });
      expect(invalidMonth.statusCode).toBe(400);
      await expect(repositories.income.listPlans({})).resolves.toEqual(existingPlans);
    } finally {
      await server.close();
    }
  });

  it("INT-FF-LOC-003-01 renders canonical transaction values with de-DE formatting", async () => {
    const repositories = createSeededInMemoryRepositories();
    await repositories.transactions.save({
      id: "transaction-de-de-format",
      accountId: "account-person-a-checking",
      categoryId: "category-groceries",
      date: "2026-12-31",
      amountCents: -123456,
      description: "Formatted German HTTP transaction",
      payee: null,
      purpose: null,
      source: "manual",
      status: "booked",
      fixedCost: false,
      internalTransfer: false,
      note: null,
      importHash: null,
    });
    const server = buildServer({ repositories });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/transactions",
        headers: await authenticatedHeaders(server),
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("31.12.2026");
      expect(response.body).toContain("1.234,56");
    } finally {
      await server.close();
    }
  });
});
