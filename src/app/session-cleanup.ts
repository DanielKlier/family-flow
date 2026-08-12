import { withSessionService } from "./session-maintenance.js";

function readLimit(arguments_: string[]): number {
  if (arguments_[0] !== "--limit" || arguments_.length !== 2) {
    throw new Error("Usage: node dist/app/session-cleanup.js --limit <1-1000>");
  }
  const limit = Number(arguments_[1]);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error("Session cleanup limit must be between 1 and 1000");
  }
  return limit;
}

const limit = readLimit(process.argv.slice(2));
const deleted = await withSessionService((sessions) => sessions.cleanup(limit));
console.info(`Session cleanup deleted ${deleted} row(s)`);
