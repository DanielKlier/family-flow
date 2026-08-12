import { readFile } from "node:fs/promises";

import { collectDeclaredEvidence } from "./traceability/collect-evidence.js";
import type { TraceabilityDocument } from "./traceability/validate.js";

async function main(): Promise<void> {
  const document = JSON.parse(await readFile("traceability.json", "utf8")) as TraceabilityDocument;
  const completedPhases = new Set(
    document.phases.filter((phase) => phase.status === "Completed").map((phase) => phase.id),
  );
  const declared = await collectDeclaredEvidence(process.cwd());
  const missing = document.tests
    .filter((test) => completedPhases.has(test.phase))
    .map((test) => test.id)
    .filter((id) => !declared.has(id))
    .sort();
  if (missing.length > 0) {
    process.stderr.write(`${missing.map((id) => `MISSING_COLLECTED_TEST ${id}`).join("\n")}\n`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `EVIDENCE_ERROR ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
