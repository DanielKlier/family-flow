import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

import type { SessionRecord, SessionStore } from "../../ports/auth/session-store.js";
import type { PostgresDatabase } from "./postgres.js";
import { sessions } from "./schema.js";

export class DrizzleSessionStore implements SessionStore {
  constructor(private readonly db: PostgresDatabase) {}

  async create(record: SessionRecord): Promise<void> {
    await this.db.insert(sessions).values({
      id: record.id,
      tokenHash: record.tokenHash,
      userId: record.user.id,
      userDisplayName: record.user.displayName,
      userEmail: record.user.email,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash));
    return row === undefined ? null : mapSession(row);
  }

  async revoke(tokenHash: string, revokedAt: Date): Promise<boolean> {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length === 1;
  }

  async deleteEligible(now: Date, limit: number): Promise<number> {
    return this.db.transaction(async (transaction) => {
      const eligible = await transaction
        .select({ id: sessions.id })
        .from(sessions)
        .where(or(lte(sessions.expiresAt, now), lte(sessions.revokedAt, now)))
        .orderBy(asc(sessions.expiresAt), asc(sessions.id))
        .limit(limit);
      if (eligible.length === 0) return 0;
      const deleted = await transaction
        .delete(sessions)
        .where(
          inArray(
            sessions.id,
            eligible.map(({ id }) => id),
          ),
        )
        .returning({ id: sessions.id });
      return deleted.length;
    });
  }

  async revokeAll(revokedAt: Date): Promise<number> {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt })
      .where(isNull(sessions.revokedAt))
      .returning({ id: sessions.id });
    return rows.length;
  }
}

function mapSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    tokenHash: row.tokenHash,
    user: { id: row.userId, displayName: row.userDisplayName, email: row.userEmail },
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}
