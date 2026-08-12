import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
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

  it("uses Vitest and Playwright collection as completed test evidence", async () => {
    const evidence = await collectDeclaredEvidence(repositoryRoot);

    expect(evidence).toContain("INT-FF-QUA-001-01");
    expect(evidence).toContain("INT-FF-QUA-004-01");
  });
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

  it("registers the completed bounded session operation verifiers", () => {
    expect(Object.keys(operationRegistry)).toEqual(
      expect.arrayContaining(["OPS-FF-AUTH-006-01", "OPS-FF-AUTH-009-01"]),
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
