import { spawn } from "node:child_process";

export type OperationResult = { operationId: string; status: "passed" | "failed" | "skipped" };
export type OperationVerifier = (environment: NodeJS.ProcessEnv) => Promise<OperationResult>;
export type OperationRegistry = Readonly<Record<string, OperationVerifier>>;

function verifyPostgresSessionOperation(id: string): OperationVerifier {
  return async (environment) => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "pnpm",
        ["exec", "tsx", "scripts/run-postgres-tests.ts", "--operation", id],
        { env: environment, stdio: "inherit" },
      );
      child.on("error", reject);
      child.on("close", (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`Operation ${id} verifier exited with ${code ?? signal}`));
      });
    });
    return { operationId: id, status: "passed" };
  };
}

// Verifiers are registered here when their owning phase delivers executable operations evidence.
// Planned operations remain in traceability.json but cannot be dispatched until registered.
export const operationRegistry: OperationRegistry = {
  "OPS-FF-AUTH-006-01": verifyPostgresSessionOperation("OPS-FF-AUTH-006-01"),
  "OPS-FF-AUTH-009-01": verifyPostgresSessionOperation("OPS-FF-AUTH-009-01"),
};

export async function verifyOperation(
  id: string,
  registry: OperationRegistry = operationRegistry,
  inheritedEnvironment: NodeJS.ProcessEnv = process.env,
): Promise<OperationResult> {
  const verifier = registry[id];
  if (!verifier) throw new Error(`Unknown operation: ${id}`);
  const result = await verifier(safeEnvironment(inheritedEnvironment));
  if (result.operationId !== id) throw new Error(`Operation result mismatch for ${id}`);
  if (result.status !== "passed") throw new Error(`Operation ${id} ${result.status}`);
  return result;
}

function safeEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    PATH: environment.PATH,
    HOME: environment.HOME,
  };
}
