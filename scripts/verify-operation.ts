import { verifyOperation } from "./operations/registry.js";

function operationId(): string {
  const index = process.argv.indexOf("--id");
  const id = process.argv[index + 1];
  if (index < 0 || !id) throw new Error("Missing --id");
  return id;
}

async function main(): Promise<void> {
  const result = await verifyOperation(operationId());
  process.stdout.write(`Operation ${result.operationId} passed\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Operation failed"}\n`);
  process.exitCode = 1;
});
