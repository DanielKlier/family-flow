import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const forbiddenPatterns: { description: string; pattern: RegExp }[] = [
  { description: "disabled autoescaping", pattern: /{%\s*autoescape\s+false\s*%}/i },
  { description: "safe filter", pattern: /\|\s*safe\b/i },
  { description: "arithmetic", pattern: /{{[^}]*\s[+*/%-]\s[^}]*}}/ },
  { description: "parser or formatter call", pattern: /{{[^}]*(?:parse|format)\w*\s*\(/i },
  { description: "repository access", pattern: /\brepositor(?:y|ies)\b/i },
  { description: "use-case access", pattern: /\buseCases?\b/i },
  { description: "template import", pattern: /{%\s*(?:from\s+.+\s+)?import\b/i },
  { description: "unapproved call", pattern: /{{[^}]*\b\w+(?:\.\w+)*\s*\([^}]*}}/ },
];

export async function checkTemplateArchitecture(directory: string): Promise<string[]> {
  const templates = await listTemplates(directory);
  const violations: string[] = [];

  for (const template of templates) {
    const source = await readFile(template, "utf8");
    for (const { description, pattern } of forbiddenPatterns) {
      if (pattern.test(source)) {
        violations.push(`${relative(directory, template)}: ${description}`);
      }
    }
  }

  return violations;
}

async function listTemplates(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listTemplates(path);
      return entry.isFile() && entry.name.endsWith(".njk") ? [path] : [];
    }),
  );
  return nested.flat();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = await checkTemplateArchitecture(resolve("src/views"));
  if (violations.length > 0) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
  }
}
