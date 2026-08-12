import { describe, expect, it } from "vitest";

import { SessionService } from "../../src/core/auth/session-service.js";
import type { SessionRecord, SessionStore } from "../../src/ports/auth/session-store.js";

class MemoryStore implements SessionStore {
  readonly records: SessionRecord[] = [];

  async create(record: SessionRecord): Promise<void> {
    this.records.push(record);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.records.find((record) => record.tokenHash === tokenHash) ?? null;
  }

  async revoke(tokenHash: string, revokedAt: Date): Promise<boolean> {
    const record = await this.findByTokenHash(tokenHash);
    if (record === null || record.revokedAt !== null) return false;
    record.revokedAt = revokedAt;
    return true;
  }

  async deleteEligible(now: Date, limit: number): Promise<number> {
    const eligible = this.records
      .filter((record) => record.expiresAt <= now || record.revokedAt !== null)
      .sort(
        (left, right) =>
          left.expiresAt.getTime() - right.expiresAt.getTime() || left.id.localeCompare(right.id),
      )
      .slice(0, limit);
    for (const record of eligible) this.records.splice(this.records.indexOf(record), 1);
    return eligible.length;
  }

  async revokeAll(revokedAt: Date): Promise<number> {
    let count = 0;
    for (const record of this.records) {
      if (record.revokedAt === null) {
        record.revokedAt = revokedAt;
        count += 1;
      }
    }
    return count;
  }
}

const now = new Date("2025-01-01T00:00:00.000Z");
const clock = { now: () => now };
const tokens = { generate: () => "opaque-token", generateId: () => "session-id" };
const hasher = { hash: (token: string) => `hash:${token}` };
const user = { id: "subject", displayName: "Test User", email: "test@example.invalid" };

describe("opaque sessions", () => {
  it("UNIT-FF-AUTH-004-01 resolves active, unknown, exactly expired, and revoked sessions", async () => {
    const store = new MemoryStore();
    const service = new SessionService(store, clock, tokens, hasher);

    const created = await service.create(user);

    expect(created).toEqual({
      token: "opaque-token",
      expiresAt: new Date("2025-01-01T08:00:00.000Z"),
    });
    expect(store.records[0]).toMatchObject({
      tokenHash: "hash:opaque-token",
      user,
      createdAt: now,
      expiresAt: new Date("2025-01-01T08:00:00.000Z"),
      revokedAt: null,
    });
    await expect(service.lookup("opaque-token")).resolves.toEqual(user);
    await expect(service.lookup("unknown")).resolves.toBeNull();

    now.setTime(Date.parse("2025-01-01T08:00:00.000Z"));
    await expect(service.lookup("opaque-token")).resolves.toBeNull();
  });

  it("UNIT-FF-AUTH-006-01 revokes tokens and performs bounded idempotent cleanup", async () => {
    const store = new MemoryStore();
    const service = new SessionService(store, clock, tokens, hasher);
    now.setTime(Date.parse("2025-01-01T00:00:00.000Z"));
    await service.create(user);

    await expect(service.revoke("opaque-token")).resolves.toBe(true);
    await expect(service.lookup("opaque-token")).resolves.toBeNull();
    await expect(service.cleanup(1_001)).rejects.toThrow("between 1 and 1000");
    await expect(service.cleanup(1_000)).resolves.toBe(1);
    await expect(service.cleanup(1_000)).resolves.toBe(0);
  });
});
