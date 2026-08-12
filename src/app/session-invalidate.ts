import { withSessionService } from "./session-maintenance.js";

if (process.argv.length !== 2) {
  throw new Error("Usage: node dist/app/session-invalidate.js");
}
const revoked = await withSessionService((sessions) => sessions.invalidateAll());
console.info(`Session invalidation revoked ${revoked} row(s)`);
