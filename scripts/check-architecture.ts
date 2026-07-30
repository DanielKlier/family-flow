import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const coreDirectory = join(process.cwd(), "src/core");
const forbiddenCoreImportPattern =
  /from\s+["'][^"']*(?:adapters|app|fastify|drizzle|postgres|htmx|templates)[^"']*["']/;

const violations: string[] = [];

for (const filePath of await listTypeScriptFiles(coreDirectory)) {
  const contents = await readFile(filePath, "utf8");
  if (forbiddenCoreImportPattern.test(contents)) {
    violations.push(relative(process.cwd(), filePath));
  }
}

if (violations.length > 0) {
  console.error("Core architecture violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(entryPath);
      }
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat();
}
