import {
  SecureSessionTokenGenerator,
  Sha256SessionTokenHasher,
} from "../adapters/auth/session-cryptography.js";
import { SystemClock } from "../adapters/clock/system-clock.js";
import { DrizzleSessionStore } from "../adapters/db/drizzle-session-store.js";
import { migrate } from "../adapters/db/migrate.js";
import { createPostgresConnection } from "../adapters/db/postgres.js";
import { SessionService } from "../core/auth/session-service.js";
import { loadConfig } from "./config.js";

export async function withSessionService<T>(
  operation: (sessions: SessionService) => Promise<T>,
): Promise<T> {
  const config = loadConfig();
  await migrate(config.databaseUrl);
  const connection = createPostgresConnection(config.databaseUrl);
  try {
    const sessions = new SessionService(
      new DrizzleSessionStore(connection.db),
      new SystemClock(),
      new SecureSessionTokenGenerator(),
      new Sha256SessionTokenHasher(),
    );
    return await operation(sessions);
  } finally {
    await connection.client.end();
  }
}
