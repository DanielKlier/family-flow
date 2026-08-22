import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn: spawnMock,
}));

import {
  type OperationRegistry,
  operationRegistry,
  verifyOperation,
} from "../../scripts/operations/registry.js";
import { collectDeclaredEvidence } from "../../scripts/traceability/collect-evidence.js";
import { validateTraceability } from "../../scripts/traceability/validate.js";
import { validatePackageScripts } from "../../scripts/traceability/validate-package.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");

async function traceabilityDocument(): Promise<unknown> {
  return JSON.parse(await readFile(join(repositoryRoot, "traceability.json"), "utf8"));
}

describe("INT-FF-QUA-001-01 structured traceability", () => {
  it("validates the machine-readable source of truth", async () => {
    expect(validateTraceability(await traceabilityDocument())).toEqual([]);
  });

  it("rejects invalid schema values and cross-references without parsing Markdown", async () => {
    const document = (await traceabilityDocument()) as {
      tests: Array<Record<string, unknown>>;
    };
    const invalid = structuredClone(document);
    invalid.tests[0] = { ...invalid.tests[0], phase: "PH-UNKNOWN" };

    expect(validateTraceability(invalid)).toContain(
      `UNDEFINED_REFERENCE tests[0].phase:PH-UNKNOWN`,
    );
  });

  it("rejects completed phases with acceptance that is not verified", async () => {
    const document = (await traceabilityDocument()) as {
      acceptance: Array<Record<string, unknown>>;
      phases: Array<Record<string, unknown>>;
    };
    const invalid = structuredClone(document);
    const phase = invalid.phases.find(({ id }) => id === "PH-10B");
    expect(phase).toBeDefined();
    const acceptance = invalid.acceptance.find(({ phase: phaseId }) => phaseId === "PH-10B");
    expect(acceptance).toBeDefined();
    if (acceptance !== undefined) acceptance.status = "Planned";

    expect(validateTraceability(invalid)).toContain(
      `INCOMPLETE_ACCEPTANCE_IN_COMPLETED_PHASE ${String(acceptance?.id)}`,
    );
  });

  it("uses Vitest and Playwright collection as completed test evidence", async () => {
    const evidence = await collectDeclaredEvidence(repositoryRoot);

    expect(evidence).toContain("INT-FF-QUA-001-01");
    expect(evidence).toContain("INT-FF-QUA-004-01");
    expect(evidence).toContain("INT-FF-CSV-012-03");
  }, 35_000);
});

describe("INT-FF-QUA-004-01 bounded quality tooling", () => {
  it("dispatches only statically registered operation verifiers with a sanitized environment", async () => {
    let receivedEnvironment: NodeJS.ProcessEnv | undefined;
    const registry: OperationRegistry = {
      "OPS-FF-DEP-002-01": async (environment) => {
        receivedEnvironment = environment;
        return { operationId: "OPS-FF-DEP-002-01", status: "passed" };
      },
    };

    await expect(
      verifyOperation("OPS-FF-DEP-002-01", registry, {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_OPTIONS: "--require=forge.cjs",
        SESSION_SECRET: "secret",
      }),
    ).resolves.toEqual({ operationId: "OPS-FF-DEP-002-01", status: "passed" });
    expect(receivedEnvironment).toEqual({ PATH: process.env.PATH, HOME: process.env.HOME });
    await expect(verifyOperation("OPS-FF-DEP-999-01", registry)).rejects.toThrow(
      "Unknown operation",
    );
  });

  it("selects current, past, future, and planned-to-booked forecast evidence", async () => {
    spawnMock.mockImplementation(() => ({
      on(event: string, listener: (code: number | null, signal: NodeJS.Signals | null) => void) {
        if (event === "close") queueMicrotask(() => listener(0, null));
        return this;
      },
    }));

    await expect(
      verifyOperation("OPS-FF-FOR-001-01", operationRegistry, {
        PATH: "/controlled/path",
        HOME: "/controlled/home",
      }),
    ).resolves.toEqual({ operationId: "OPS-FF-FOR-001-01", status: "passed" });

    expect(spawnMock.mock.calls.map(([, arguments_]) => arguments_)).toEqual([
      ["exec", "vitest", "run", "tests/unit/dashboard.test.ts", "--testNamePattern", "UNIT-FF-FOR"],
      [
        "exec",
        "playwright",
        "test",
        "tests/e2e/dashboard.test.ts",
        "--grep",
        "(?:E2E-FF-FOR|distinguishes localized past and future dashboard months)",
        "--workers=1",
      ],
    ]);
  });

  it("selects deployment and reverse-proxy smoke evidence", async () => {
    spawnMock.mockClear();
    spawnMock.mockImplementation(() => ({
      on(event: string, listener: (code: number | null, signal: NodeJS.Signals | null) => void) {
        if (event === "close") queueMicrotask(() => listener(0, null));
        return this;
      },
    }));

    for (const id of ["OPS-FF-DEP-002-01", "OPS-FF-DEP-003-01"]) {
      await expect(
        verifyOperation(id, operationRegistry, {
          PATH: "/controlled/path",
          HOME: "/controlled/home",
        }),
      ).resolves.toEqual({ operationId: id, status: "passed" });
    }

    expect(spawnMock.mock.calls.map(([, arguments_]) => arguments_)).toEqual([
      [
        "exec",
        "playwright",
        "test",
        "tests/e2e/deployment-smoke.test.ts",
        "--grep",
        "(?:SMOKE-FF-SCP-001-01|SMOKE-FF-DEP-002-01)",
        "--workers=1",
      ],
      [
        "exec",
        "playwright",
        "test",
        "tests/e2e/deployment-smoke.test.ts",
        "--grep",
        "(?:SMOKE-FF-SCP-001-02|SMOKE-FF-DEP-003-01)",
        "--workers=1",
      ],
    ]);
  });

  it("selects exact request lifecycle and sanitized logging evidence", async () => {
    spawnMock.mockClear();
    spawnMock.mockImplementation(() => ({
      on(event: string, listener: (code: number | null, signal: NodeJS.Signals | null) => void) {
        if (event === "close") queueMicrotask(() => listener(0, null));
        return this;
      },
    }));

    await expect(
      verifyOperation("OPS-FF-OBS-003-01", operationRegistry, {
        PATH: "/controlled/path",
        HOME: "/controlled/home",
      }),
    ).resolves.toEqual({ operationId: "OPS-FF-OBS-003-01", status: "passed" });

    expect(spawnMock.mock.calls.map(([, arguments_]) => arguments_)).toEqual([
      [
        "exec",
        "vitest",
        "run",
        "tests/unit/request-log-context.test.ts",
        "tests/integration/request-logging.test.ts",
      ],
      ["exec", "playwright", "test", "tests/e2e/request-id.test.ts", "--workers=1"],
    ]);
  });

  it("registers the completed bounded operation verifiers", () => {
    expect(Object.keys(operationRegistry)).toEqual(
      expect.arrayContaining([
        "OPS-FF-AUTH-006-01",
        "OPS-FF-AUTH-009-01",
        "OPS-FF-DASH-001-01",
        "OPS-FF-DEP-002-01",
        "OPS-FF-DEP-003-01",
        "OPS-FF-FOR-001-01",
        "OPS-FF-INC-001-01",
        "OPS-FF-OBS-003-01",
        "OPS-FF-TXN-005-01",
      ]),
    );
  });

  it("keeps mandatory package commands as exact allowlisted wiring", async () => {
    const packageJson = JSON.parse(
      await readFile(join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(validatePackageScripts(packageJson)).toEqual([]);
    expect(
      validatePackageScripts({
        scripts: { ...packageJson.scripts, "test:postgres": "echo skipped" },
      }),
    ).toContain("INVALID_COMMAND_WIRING package.json:test:postgres");
  });
});
