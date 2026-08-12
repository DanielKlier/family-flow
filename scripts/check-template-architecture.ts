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

const userVisibleAttributes = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "hx-confirm",
  "hx-prompt",
  "placeholder",
  "title",
]);

const attributePattern = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

export async function checkTemplateArchitecture(directory: string): Promise<string[]> {
  const templates = await listTemplates(directory);
  const violations: string[] = [];

  for (const template of templates) {
    const source = await readFile(template, "utf8");
    const templateName = relative(directory, template);
    for (const { description, pattern } of forbiddenPatterns) {
      if (pattern.test(source)) {
        violations.push(`${templateName}: ${description}`);
      }
    }
    if (containsUserFacingLiteral(source)) {
      violations.push(`${templateName}: user-facing display literal`);
    }
  }

  return violations;
}

function containsUserFacingLiteral(source: string): boolean {
  const normalized = removeNunjucksTokens(source);
  let position = 0;

  while (position < normalized.length) {
    const tagStart = normalized.indexOf("<", position);
    const textEnd = tagStart === -1 ? normalized.length : tagStart;
    if (normalized.slice(position, textEnd).trim().length > 0) return true;
    if (tagStart === -1) return false;

    if (normalized.startsWith("<!--", tagStart)) {
      const commentEnd = normalized.indexOf("-->", tagStart + 4);
      position = commentEnd === -1 ? normalized.length : commentEnd + 3;
      continue;
    }

    const tagEnd = findTagEnd(normalized, tagStart + 1);
    if (tagEnd === -1) return false;
    if (tagContainsUserFacingLiteral(normalized.slice(tagStart + 1, tagEnd))) return true;
    position = tagEnd + 1;
  }

  return false;
}

function removeNunjucksTokens(source: string): string {
  let normalized = "";
  let position = 0;

  while (position < source.length) {
    const tokenStart = source.indexOf("{", position);
    if (tokenStart === -1) return normalized + source.slice(position);
    normalized += source.slice(position, tokenStart);

    const tokenType = source.slice(tokenStart, tokenStart + 2);
    const tokenEndMarker = tokenType === "{{" ? "}}" : tokenType === "{%" ? "%}" : "#}";
    if (tokenType !== "{{" && tokenType !== "{%" && tokenType !== "{#") {
      normalized += "{";
      position = tokenStart + 1;
      continue;
    }

    const tokenEnd = source.indexOf(tokenEndMarker, tokenStart + 2);
    if (tokenEnd === -1) return normalized + source.slice(tokenStart);
    const token = source.slice(tokenStart, tokenEnd + 2);
    normalized += token.replace(/[^\n]/g, " ");
    position = tokenEnd + 2;

    if (/^{%[-\s]*raw\b/.test(token)) {
      const rawEndStart = source.slice(position).search(/{%[-\s]*endraw\b/);
      if (rawEndStart === -1) return normalized + source.slice(position);
      normalized += source.slice(position, position + rawEndStart);
      position += rawEndStart;
    }
  }

  return normalized;
}

function findTagEnd(source: string, position: number): number {
  let quote: '"' | "'" | undefined;
  for (let index = position; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function tagContainsUserFacingLiteral(tag: string): boolean {
  for (const match of tag.matchAll(attributePattern)) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    if (
      name &&
      userVisibleAttributes.has(name.toLowerCase()) &&
      (doubleQuoted ?? singleQuoted ?? unquoted ?? "").trim().length > 0
    ) {
      return true;
    }
  }
  return false;
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
