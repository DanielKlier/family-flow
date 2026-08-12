const expectedScripts: Readonly<Record<string, string>> = {
  "format:check": "biome format .",
  lint: "biome lint . && pnpm arch:check && pnpm requirements:check",
  test: "vitest run",
  "test:e2e": "playwright test",
  build:
    "tsc -p tsconfig.json && mkdir -p dist/adapters/http/assets && cp src/adapters/http/assets/app.css dist/adapters/http/assets/app.css",
  "requirements:check": "tsx scripts/check-requirement-traceability.ts",
  "evidence:check": "tsx scripts/check-test-evidence.ts",
  "test:postgres": "tsx scripts/run-postgres-tests.ts",
  "ops:verify": "env -u NODE_OPTIONS tsx scripts/verify-operation.ts",
  verify:
    "pnpm format:check && pnpm lint && pnpm test && pnpm evidence:check && pnpm test:e2e && pnpm build",
};

export function validatePackageScripts(value: unknown): string[] {
  if (!isObject(value) || !isObject(value.scripts)) return ["INVALID_PACKAGE_JSON package.json"];
  const diagnostics: string[] = [];
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (value.scripts[name] !== command)
      diagnostics.push(`INVALID_COMMAND_WIRING package.json:${name}`);
  }
  return diagnostics.sort();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
