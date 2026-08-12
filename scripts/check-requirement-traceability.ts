import { readFile } from "node:fs/promises";

import { validatePackageScripts } from "./traceability/validate-package.js";
import { validateTraceability } from "./traceability/validate.js";

async function main(): Promise<void> {
  const [document, packageJson]: [unknown, unknown] = await Promise.all([
    readFile("traceability.json", "utf8").then(JSON.parse),
    readFile("package.json", "utf8").then(JSON.parse),
  ]);
  const diagnostics = [
    ...validateTraceability(document),
    ...validatePackageScripts(packageJson),
  ].sort();
  if (diagnostics.length > 0) {
    process.stderr.write(`${diagnostics.join("\n")}\n`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `VALIDATOR_ERROR ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
