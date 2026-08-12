import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { aTransaction } from "../support/transactions.js";

const transactionInput = {
  accounts: [],
  categories: [],
  ownerContexts: [],
  transactions: [
    aTransaction({ description: '<img src=x onerror="globalThis.xssExecuted=true">' }),
  ],
  filters: {},
};

describe("INT-FF-ARC-003-01 Nunjucks rendering", () => {
  it("uses the registered @fastify/view integration to escape pages and fragments", async () => {
    const { createFamilyFlowViews, registerTemplateRenderer } = await import(
      "../../src/adapters/http/views.js"
    );
    const templateDirectory = await mkdtemp(join(tmpdir(), "family-flow-views-"));
    await writeFile(
      join(templateDirectory, "transactions.njk"),
      "{% for row in list.rows %}<p>{{ row.description }}</p>{% endfor %}",
    );
    const server = Fastify();
    registerTemplateRenderer(server, templateDirectory);
    server.get("/page", async (_request, reply) =>
      createFamilyFlowViews(reply).transactionsPage(transactionInput),
    );
    server.get("/fragment", async (_request, reply) =>
      createFamilyFlowViews(reply).transactionsList(transactionInput),
    );

    const expected = "&lt;img src=x onerror=&quot;globalThis.xssExecuted=true&quot;&gt;";
    const page = await server.inject("/page");
    const fragment = await server.inject("/fragment");
    await server.close();

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain(expected);
    expect(fragment.statusCode).toBe(200);
    expect(fragment.body).toContain(expected);
  });
});

describe("INT-FF-ARC-004-01 template presentation boundary", () => {
  it.each([
    ["disabled autoescaping", "{% autoescape false %}{{ text }}{% endautoescape %}"],
    ["safe filter", "{{ text | safe }}"],
    ["arithmetic", "{{ amount + 1 }}"],
    ["formatting helper", "{{ formatAmount(amount) }}"],
    ["repository access", "{{ repositories.transactions.list() }}"],
    ["use-case access", "{{ useCases.createTransaction() }}"],
    ["template import", '{% import "helpers.njk" as helpers %}'],
    ["unapproved call", "{{ helper(text) }}"],
  ])("rejects %s", async (_description, template) => {
    const { checkTemplateArchitecture } = await import(
      "../../scripts/check-template-architecture.js"
    );
    const templateDirectory = await mkdtemp(join(tmpdir(), "family-flow-template-check-"));
    await writeFile(join(templateDirectory, "unsafe.njk"), template);

    await expect(checkTemplateArchitecture(templateDirectory)).resolves.toEqual(
      expect.arrayContaining([expect.stringContaining("unsafe.njk")]),
    );
  });
});

describe("INT-FF-ARC-004-02 typed rendering contract", () => {
  it("exposes named page and fragment methods instead of arbitrary template/context rendering", async () => {
    const { createFamilyFlowViews } = await import("../../src/adapters/http/views.js");
    const viewAsync = vi.fn();
    const views = createFamilyFlowViews({ viewAsync });

    expect(views).toEqual(
      expect.objectContaining({
        transactionsPage: expect.any(Function),
        transactionsPanel: expect.any(Function),
        transactionsList: expect.any(Function),
        authLoginPage: expect.any(Function),
        masterDataPage: expect.any(Function),
        categorizationRulesPage: expect.any(Function),
        csvImportPage: expect.any(Function),
        incomePage: expect.any(Function),
      }),
    );
    expect(views).not.toHaveProperty("render");
    expect(views).not.toHaveProperty("view");

    await views.transactionsList(transactionInput);
    expect(viewAsync).toHaveBeenCalledWith("transactions.njk", expect.any(Object));
  });
});
