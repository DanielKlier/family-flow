import { execFileSync } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const buildTimeoutMs = 30_000;

async function listTemplates(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listTemplates(path);
      return entry.isFile() && entry.name.endsWith(".njk") ? [path] : [];
    }),
  );
  return files.flat();
}

describe("INT-FF-DEP-001-01 compiled template packaging", () => {
  beforeAll(() => {
    execFileSync("pnpm", ["build"], {
      cwd: repositoryRoot,
      stdio: "pipe",
      timeout: buildTimeoutMs,
    });
  }, buildTimeoutMs);

  it("ships the complete declared layout, page, and fragment inventory to dist/views", async () => {
    const sourceViews = join(repositoryRoot, "src/views");
    const sourceTemplates = await listTemplates(sourceViews);
    const templatePaths = sourceTemplates.map((template) => relative(sourceViews, template));
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
      "partials/income-edit-panel.njk",
      "partials/transactions-panel.njk",
      "partials/transactions-list.njk",
    ];

    expect(templatePaths).toEqual(expect.arrayContaining(requiredTemplates));
    for (const templatePath of requiredTemplates) {
      await expect(
        access(join(repositoryRoot, "dist/views", templatePath)),
      ).resolves.toBeUndefined();
    }
  });

  it("resolves source templates when the application executes from src", async () => {
    const { resolveTemplateDirectory } = await import("../../src/adapters/http/views.js");

    expect(resolveTemplateDirectory()).toBe(join(repositoryRoot, "src/views"));
  });

  it("resolves packaged templates when the application executes from dist", async () => {
    const { resolveTemplateDirectory } = await import("../../dist/adapters/http/views.js");

    expect(resolveTemplateDirectory()).toBe(join(repositoryRoot, "dist/views"));
  });
});
