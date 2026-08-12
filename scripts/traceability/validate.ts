export type TraceabilityDocument = {
  version: number;
  requirements: Array<{ id: string; acceptanceCriteria: string[] }>;
  phases: Array<{
    id: string;
    status: "Completed" | "Pending";
    summary: string;
    classification: string | null;
  }>;
  acceptance: Array<{
    id: string;
    status: "Verified" | "Delivered-unverified" | "Gap" | "Planned";
    phase: string;
    test: string;
    file: string;
    operation: string | null;
  }>;
  tests: Array<{
    id: string;
    acceptance: string;
    phase: string;
    file: string;
    boundary: EvidenceBoundary;
    classification: "Expected red before production change" | "Expected green evidence";
  }>;
  operations: Array<{
    id: string;
    procedure: string;
    outcome: string;
    rollback: string;
    verifier: string | null;
  }>;
};

type EvidenceBoundary =
  | "End-to-end"
  | "Core"
  | "HTTP adapter"
  | "PostgreSQL adapter"
  | "CSV adapter"
  | "Integration";

const patterns = {
  requirement: /^FF-[A-Z]+-[0-9]{3}$/,
  acceptance: /^FF-[A-Z]+-[0-9]{3}-AC[0-9]{2}$/,
  phase: /^PH-[0-9]{2}(?:[A-Z]|-R[0-9]{2})?$/,
  test: /^(?:E2E|UNIT|INT|SMOKE)-FF-[A-Z]+-[0-9]{3}-[0-9]{2}$/,
  operation: /^OPS-FF-[A-Z]+-[0-9]{3}-[0-9]{2}$/,
};

export function validateTraceability(value: unknown): string[] {
  if (!isObject(value)) return ["INVALID_SCHEMA root"];
  const requiredArrays = ["requirements", "phases", "acceptance", "tests", "operations"] as const;
  const diagnostics: string[] = [];
  if (value.version !== 1) diagnostics.push("INVALID_SCHEMA version");
  for (const field of requiredArrays) {
    if (!Array.isArray(value[field])) diagnostics.push(`INVALID_SCHEMA ${field}`);
  }
  if (diagnostics.length > 0) return diagnostics.sort();

  const document = value as TraceabilityDocument;
  validateRows(document.requirements, "requirements", patterns.requirement, diagnostics);
  const phaseIds = validateRows(document.phases, "phases", patterns.phase, diagnostics);
  const acceptanceIds = validateRows(
    document.acceptance,
    "acceptance",
    patterns.acceptance,
    diagnostics,
  );
  const testIds = validateRows(document.tests, "tests", patterns.test, diagnostics);
  const operationIds = validateRows(
    document.operations,
    "operations",
    patterns.operation,
    diagnostics,
  );

  document.requirements.forEach((requirement, index) => {
    if (!Array.isArray(requirement.acceptanceCriteria)) {
      diagnostics.push(`INVALID_SCHEMA requirements[${index}].acceptanceCriteria`);
      return;
    }
    for (const id of requirement.acceptanceCriteria) {
      reference(id, acceptanceIds, `requirements[${index}].acceptanceCriteria`, diagnostics);
      if (!id.startsWith(`${requirement.id}-AC`)) diagnostics.push(`MAPPING_MISMATCH ${id}`);
    }
  });

  document.phases.forEach((phase, index) => {
    if (!/^(Completed|Pending)$/.test(phase.status) || !phase.summary)
      diagnostics.push(`INVALID_SCHEMA phases[${index}]`);
    if (phase.status === "Pending" && !phase.classification)
      diagnostics.push(`INVALID_SCHEMA phases[${index}].classification`);
  });

  document.acceptance.forEach((row, index) => {
    if (!/^(Verified|Delivered-unverified|Gap|Planned)$/.test(row.status))
      diagnostics.push(`INVALID_SCHEMA acceptance[${index}].status`);
    reference(row.phase, phaseIds, `acceptance[${index}].phase`, diagnostics);
    reference(row.test, testIds, `acceptance[${index}].test`, diagnostics);
    if (row.operation)
      reference(row.operation, operationIds, `acceptance[${index}].operation`, diagnostics);
    const test = document.tests.find((candidate) => candidate.id === row.test);
    if (test && (test.acceptance !== row.id || test.phase !== row.phase || test.file !== row.file))
      diagnostics.push(`MAPPING_MISMATCH ${row.test}`);
    const phaseStatus = document.phases.find((phase) => phase.id === row.phase)?.status;
    if (row.status === "Verified" && phaseStatus !== "Completed")
      diagnostics.push(`VERIFIED_INCOMPLETE_PHASE ${row.id}`);
    if (row.status !== "Verified" && phaseStatus === "Completed")
      diagnostics.push(`INCOMPLETE_ACCEPTANCE_IN_COMPLETED_PHASE ${row.id}`);
  });

  document.tests.forEach((row, index) => {
    reference(row.acceptance, acceptanceIds, `tests[${index}].acceptance`, diagnostics);
    reference(row.phase, phaseIds, `tests[${index}].phase`, diagnostics);
    if (!validTestFile(row.id, row.file)) diagnostics.push(`WRONG_TEST_FILE ${row.id}`);
    if (boundaryFor(row.file) !== row.boundary)
      diagnostics.push(`WRONG_ADAPTER_BOUNDARY ${row.id}`);
    if (
      !/^(Expected red before production change|Expected green evidence)$/.test(row.classification)
    )
      diagnostics.push(`INVALID_SCHEMA tests[${index}].classification`);
  });

  document.operations.forEach((row, index) => {
    if (!row.procedure || !row.outcome || !row.rollback)
      diagnostics.push(`INVALID_SCHEMA operations[${index}]`);
  });
  return [...new Set(diagnostics)].sort();
}

function validateRows(
  rows: unknown[],
  field: string,
  pattern: RegExp,
  diagnostics: string[],
): Set<string> {
  const ids = new Set<string>();
  rows.forEach((row, index) => {
    if (!isObject(row) || typeof row.id !== "string") {
      diagnostics.push(`INVALID_SCHEMA ${field}[${index}].id`);
      return;
    }
    if (!pattern.test(row.id)) diagnostics.push(`MALFORMED_ID ${field}[${index}].id:${row.id}`);
    if (ids.has(row.id)) diagnostics.push(`DUPLICATE_ID ${row.id}`);
    ids.add(row.id);
  });
  return ids;
}

function reference(id: string, inventory: Set<string>, path: string, diagnostics: string[]): void {
  if (!inventory.has(id)) diagnostics.push(`UNDEFINED_REFERENCE ${path}:${id}`);
}

function validTestFile(id: string, file: string): boolean {
  if (!/^tests\/(?:e2e|unit|integration)\/[a-z0-9-]+\.test\.ts$/.test(file)) return false;
  if (id.startsWith("E2E-")) return file.startsWith("tests/e2e/");
  if (id.startsWith("UNIT-")) return file.startsWith("tests/unit/");
  if (id.startsWith("INT-")) return file.startsWith("tests/integration/");
  return file.startsWith("tests/e2e/") || file.startsWith("tests/integration/");
}

function boundaryFor(file: string): EvidenceBoundary {
  if (file.startsWith("tests/e2e/")) return "End-to-end";
  if (file.startsWith("tests/unit/")) return "Core";
  const name = file.split("/").at(-1) ?? "";
  if (name.endsWith("-http.test.ts")) return "HTTP adapter";
  if (name.startsWith("drizzle-") || name.startsWith("postgres-") || name.includes("migration"))
    return "PostgreSQL adapter";
  if (name === "csv-parser.test.ts") return "CSV adapter";
  return "Integration";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
