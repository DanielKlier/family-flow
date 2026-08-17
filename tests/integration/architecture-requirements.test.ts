import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { messages } from "../../src/adapters/localization/german-catalog.js";
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
    const { createGermanLocalization: createLocalization } = await import(
      "../../src/adapters/localization/german.js"
    );
    const templateDirectory = await mkdtemp(join(tmpdir(), "family-flow-views-"));
    await Promise.all([
      mkdir(join(templateDirectory, "pages")),
      mkdir(join(templateDirectory, "partials")),
    ]);
    const template = "{% for row in list.rows %}<p>{{ row.description }}</p>{% endfor %}";
    await Promise.all([
      writeFile(join(templateDirectory, "pages/transactions.njk"), template),
      writeFile(join(templateDirectory, "partials/transactions-list.njk"), template),
    ]);
    const server = Fastify();
    registerTemplateRenderer(server, templateDirectory);
    server.get("/page", async (_request, reply) =>
      createFamilyFlowViews(reply, createLocalization()).transactionsPage(transactionInput),
    );
    server.get("/fragment", async (_request, reply) =>
      createFamilyFlowViews(reply, createLocalization()).transactionsList(transactionInput),
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
  it("rejects display literals in presentation-ready bounded templates", async () => {
    const { checkTemplateArchitecture } = await import(
      "../../scripts/check-template-architecture.js"
    );
    const templateDirectory = await mkdtemp(join(tmpdir(), "family-flow-template-check-"));
    await mkdir(join(templateDirectory, "pages"));
    await writeFile(
      join(templateDirectory, "pages/new-phase-10b-surface.njk"),
      "<button>Literal returns</button>",
    );

    await expect(checkTemplateArchitecture(templateDirectory)).resolves.toContain(
      "pages/new-phase-10b-surface.njk: user-facing display literal",
    );
  });

  it.each([
    [
      "literal prefix before multiple expressions",
      "<button>Delete {{ first }} {{ second }}</button>",
    ],
    [
      "literal infix between multiple expressions",
      "<button>{{ first }} Delete {{ second }}</button>",
    ],
    [
      "literal suffix after multiple expressions",
      "<button>{{ first }} {{ second }} Delete</button>",
    ],
    ["control-wrapped mixed text", "<button>{% if enabled %}Delete {{ item }}{% endif %}</button>"],
    [
      "placeholder literal before multiple expressions",
      '<input placeholder="Search {{ first }} {{ second }}">',
    ],
    [
      "placeholder literal between multiple expressions",
      '<input placeholder="{{ first }} Search {{ second }}">',
    ],
    [
      "placeholder literal after multiple expressions",
      '<input placeholder="{{ first }} {{ second }} Search">',
    ],
    ["placeholder literal in a control", '<input placeholder="{% if enabled %}Search{% endif %}">'],
    ["aria-label literal", '<input aria-label="Search {{ item }}">'],
    ["aria-description literal", '<input aria-description="Search {{ item }}">'],
    ["aria-placeholder literal", '<input aria-placeholder="Search {{ item }}">'],
    ["aria-roledescription literal", '<input aria-roledescription="Search {{ item }}">'],
    ["aria-valuetext literal", '<input aria-valuetext="Search {{ item }}">'],
    ["title literal", '<input title="Search {{ item }}">'],
    ["alternative text literal", '<img alt="Search {{ item }}">'],
    ["HTMX confirmation literal", '<button hx-confirm="Delete {{ item }}">{{ item }}</button>'],
    ["HTMX prompt literal", '<button hx-prompt="Search {{ item }}">{{ item }}</button>'],
    ["literal in a raw block", "<button>{% raw %}Delete {{ item }}{% endraw %}</button>"],
  ])("rejects mixed display text with %s", async (_description, template) => {
    const { checkTemplateArchitecture } = await import(
      "../../scripts/check-template-architecture.js"
    );
    const templateDirectory = await mkdtemp(join(tmpdir(), "family-flow-template-check-"));
    await writeFile(join(templateDirectory, "unsafe.njk"), template);

    await expect(checkTemplateArchitecture(templateDirectory)).resolves.toEqual([
      "unsafe.njk: user-facing display literal",
    ]);
  });

  it.each([
    ["expression-only text", "<button>{{ text.delete }}</button>"],
    ["adjacent expressions", "<p>{{ first }} {{ second }}</p>"],
    ["whitespace around adjacent expressions", "<p>\n  {{ first }} {{ second }}\n</p>"],
    ["structural label whitespace", '<label>{{ text.name }} <input name="name"></label>'],
    ["control-only text", "<button>{% if enabled %}{% endif %}</button>"],
    [
      "control and expression-only text",
      "<button>{% if enabled %}{{ text.on }}{% else %}{{ text.off }}{% endif %}</button>",
    ],
    [
      "expression-only display attributes",
      '<img placeholder="{{ text.query }}" aria-label="{{ text.search }}" aria-description="{{ text.description }}" aria-placeholder="{{ text.placeholder }}" aria-roledescription="{{ text.role }}" aria-valuetext="{{ text.value }}" title="{{ text.tooltip }}" alt="{{ text.alt }}">',
    ],
    [
      "control and expression-only display attributes",
      '<button title="{% if enabled %}{{ text.on }}{% else %}{{ text.off }}{% endif %}" hx-confirm="{{ text.confirm }}" hx-prompt="{{ text.prompt }}">{{ text.submit }}</button>',
    ],
    ["control-only display attribute", '<input title="{% if enabled %}{% endif %}">'],
    ["whitespace-only display attributes", '<input placeholder="  \n  " title="\t">'],
    ["Nunjucks comments", "<button>{# translator context #}{{ text.submit }}</button>"],
    [
      "non-display attributes",
      '<button class="Delete" id="delete" href="/delete">{{ text.delete }}</button>',
    ],
  ])("allows %s", async (_description, template) => {
    const { checkTemplateArchitecture } = await import(
      "../../scripts/check-template-architecture.js"
    );
    const templateDirectory = await mkdtemp(join(tmpdir(), "family-flow-template-check-"));
    await writeFile(join(templateDirectory, "allowed.njk"), template);

    await expect(checkTemplateArchitecture(templateDirectory)).resolves.toEqual([]);
  });

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
    const { createGermanLocalization: createLocalization } = await import(
      "../../src/adapters/localization/german.js"
    );
    const viewAsync = vi.fn();
    const views = createFamilyFlowViews({ viewAsync }, createLocalization());

    const namedViews: Record<string, unknown> = views;
    const requiredMethods = [
      "dashboardPage",
      "authLoginPage",
      "authErrorPage",
      "missingResourcePage",
      "masterDataPage",
      "accountEditPage",
      "categoryEditPage",
      "categorizationRulesPage",
      "categorizationRuleEditPage",
      "csvImportPage",
      "incomePage",
      "incomePanel",
      "incomeEditPage",
      "incomeEditPanel",
      "transactionsPage",
      "transactionsPanel",
      "transactionsList",
      "transactionEditPage",
      "transactionEditPanel",
    ];

    for (const method of requiredMethods) {
      expect(namedViews, `${method} must be a named asynchronous view boundary`).toHaveProperty(
        method,
        expect.any(Function),
      );
    }
    expect(views).not.toHaveProperty("render");
    expect(views).not.toHaveProperty("view");

    await views.transactionsList(transactionInput);
    expect(viewAsync).toHaveBeenCalledWith("partials/transactions-list.njk", expect.any(Object));
  });

  it("has no legacy TypeScript HTML renderers or direct HTML assembly at HTTP view boundaries", async () => {
    const legacyTemplateDirectory = join(import.meta.dirname, "../../src/adapters/http/templates");
    const viewsSource = await readFile(
      join(import.meta.dirname, "../../src/adapters/http/views.ts"),
      "utf8",
    );

    await expect(readdir(legacyTemplateDirectory)).rejects.toMatchObject({ code: "ENOENT" });
    expect(viewsSource).not.toContain("./templates/");
    expect(viewsSource).not.toMatch(/return\s+[`'"]/);
  });

  it("INT-FF-ARC-004-03 keeps the complete prepared-view template inventory free of user-facing display literals", async () => {
    const { checkTemplateArchitecture } = await import(
      "../../scripts/check-template-architecture.js"
    );
    const templateDirectory = join(import.meta.dirname, "../../src/views");

    await expect(checkTemplateArchitecture(templateDirectory)).resolves.not.toEqual(
      expect.arrayContaining([expect.stringContaining("user-facing display literal")]),
    );
  });

  it("targets declared page, layout, and fragment templates through @fastify/view", async () => {
    const requiredTemplates = [
      "layouts/app.njk",
      "pages/dashboard.njk",
      "pages/login.njk",
      "pages/auth-error.njk",
      "pages/resource-error.njk",
      "pages/master-data.njk",
      "pages/account-edit.njk",
      "pages/category-edit.njk",
      "pages/categorization-rules.njk",
      "pages/categorization-rule-edit.njk",
      "pages/csv-import.njk",
      "pages/income.njk",
      "pages/income-edit.njk",
      "pages/transactions.njk",
      "partials/income-panel.njk",
      "partials/transactions-panel.njk",
      "partials/transactions-list.njk",
    ];

    for (const template of requiredTemplates) {
      await expect(
        readFile(join(import.meta.dirname, "../../src/views", template), "utf8"),
        template,
      ).resolves.toEqual(expect.any(String));
    }
  });
});

describe("INT-FF-ARC-007-01 localization boundary", () => {
  it("INT-FF-ARC-007-02 confines locale identifiers, format APIs, and German presentation catalogs to the localization adapter", async () => {
    const sourceDirectory = join(import.meta.dirname, "../../src");
    const localizationDirectory = join(sourceDirectory, "adapters/localization");
    const violations: string[] = [];
    const localeSensitiveApi =
      /\b(?:Intl\.[A-Za-z]+|localeCompare|toLocale(?:String|DateString|TimeString|LowerCase|UpperCase))\s*\(/;
    const localeIdentifier = /\b(?:[Gg]erman[A-Za-z0-9_]*|de-DE)\b/;
    const forbiddenFallbackLiterals = ["Other", "Person A", "Person B", "Shared"];
    const knownLocalizedLiterals = Object.values(messages).map((message) =>
      JSON.stringify(message),
    );

    for (const filePath of await listTypeScriptFiles(sourceDirectory)) {
      if (filePath.startsWith(localizationDirectory)) continue;

      const source = await readFile(filePath, "utf8");
      const relativePath = relative(join(sourceDirectory, ".."), filePath);
      const sourceWithoutCompositionWiring =
        relativePath === "src/app/server.ts"
          ? source.replace(
              /import\s+[\s\S]*?from\s+["']\.\.\/adapters\/localization\/[^"']+["'];?/g,
              (wiring) => wiring.replace(/[^\n]/g, " "),
            )
          : source;
      for (const [lineNumber, line] of sourceWithoutCompositionWiring.split("\n").entries()) {
        const hasCatalogLiteral = knownLocalizedLiterals.some((literal) => line.includes(literal));
        const hasFallbackLiteral = forbiddenFallbackLiterals.some((literal) =>
          [`"${literal}"`, `'${literal}'`, `\`${literal}\``].some((quoted) =>
            line.includes(quoted),
          ),
        );
        if (
          localeIdentifier.test(line) ||
          localeSensitiveApi.test(line) ||
          hasCatalogLiteral ||
          hasFallbackLiteral
        ) {
          violations.push(`${relativePath}:${lineNumber + 1}`);
        }
      }
    }

    expect(violations).toEqual([]);

    const germanAdapter = await readFile(join(localizationDirectory, "german.ts"), "utf8");
    expect(germanAdapter).not.toMatch(/ownerContext\s*:/);
    expect(germanAdapter).not.toMatch(/(?:accounts|categories)\s*:\s*\[/);
  });

  it("keeps user-facing validation messages out of the transaction core", async () => {
    const source = await readFile(
      join(import.meta.dirname, "../../src/core/transactions/transaction.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/throw new Error\(["'][A-Z]/);
    expect(source).not.toContain("parsePositiveDecimalCents");
  });
});

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) return listTypeScriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    }),
  );

  return files.flat();
}
