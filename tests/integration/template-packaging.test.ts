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

  it("copies every source Nunjucks template to the matching dist/views path", async () => {
    const sourceViews = join(repositoryRoot, "src/views");
    const sourceTemplates = await listTemplates(sourceViews);
    expect(sourceTemplates).not.toEqual([]);

    for (const sourceTemplate of sourceTemplates) {
      const templatePath = relative(sourceViews, sourceTemplate);
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
