import type { SessionRecord, SessionStore } from "../../ports/auth/session-store.js";

export class InMemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>();

  async create(record: SessionRecord): Promise<void> {
    this.records.set(record.tokenHash, clone(record));
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const record = this.records.get(tokenHash);
    return record === undefined ? null : clone(record);
  }

  async revoke(tokenHash: string, revokedAt: Date): Promise<boolean> {
    const record = this.records.get(tokenHash);
    if (record === undefined || record.revokedAt !== null) return false;
    record.revokedAt = new Date(revokedAt);
    return true;
  }

  async deleteEligible(now: Date, limit: number): Promise<number> {
    const records = [...this.records.values()]
      .filter((record) => record.expiresAt <= now || record.revokedAt !== null)
      .sort(
        (left, right) =>
          left.expiresAt.getTime() - right.expiresAt.getTime() || left.id.localeCompare(right.id),
      )
      .slice(0, limit);
    for (const record of records) this.records.delete(record.tokenHash);
    return records.length;
  }

  async revokeAll(revokedAt: Date): Promise<number> {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.revokedAt === null) {
        record.revokedAt = new Date(revokedAt);
        count += 1;
      }
    }
    return count;
  }
}

function clone(record: SessionRecord): SessionRecord {
  return {
    ...record,
    user: { ...record.user },
    createdAt: new Date(record.createdAt),
    expiresAt: new Date(record.expiresAt),
    revokedAt: record.revokedAt === null ? null : new Date(record.revokedAt),
  };
}
