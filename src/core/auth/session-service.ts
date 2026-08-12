import type {
  SessionTokenGenerator,
  SessionTokenHasher,
} from "../../ports/auth/session-cryptography.js";
import type { SessionStore } from "../../ports/auth/session-store.js";
import type { UserContext } from "../../ports/auth/user-context.js";
import type { Clock } from "../../ports/clock/clock.js";

const sessionLifetimeMilliseconds = 8 * 60 * 60 * 1_000;
const maximumCleanupLimit = 1_000;

export class SessionService {
  constructor(
    private readonly store: SessionStore,
    private readonly clock: Clock,
    private readonly tokens: SessionTokenGenerator,
    private readonly hasher: SessionTokenHasher,
  ) {}

  async create(user: UserContext): Promise<{ token: string; expiresAt: Date }> {
    const token = this.tokens.generate();
    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + sessionLifetimeMilliseconds);
    await this.store.create({
      id: this.tokens.generateId(),
      tokenHash: this.hasher.hash(token),
      user,
      createdAt,
      expiresAt,
      revokedAt: null,
    });
    return { token, expiresAt };
  }

  async lookup(token: string | undefined): Promise<UserContext | null> {
    if (token === undefined || token === "") return null;
    const record = await this.store.findByTokenHash(this.hasher.hash(token));
    if (record === null || record.revokedAt !== null || record.expiresAt <= this.clock.now()) {
      return null;
    }
    return record.user;
  }

  async revoke(token: string | undefined): Promise<boolean> {
    if (token === undefined || token === "") return false;
    return this.store.revoke(this.hasher.hash(token), this.clock.now());
  }

  async cleanup(limit: number): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1 || limit > maximumCleanupLimit) {
      throw new Error("Session cleanup limit must be between 1 and 1000");
    }
    return this.store.deleteEligible(this.clock.now(), limit);
  }

  async invalidateAll(): Promise<number> {
    return this.store.revokeAll(this.clock.now());
  }
}
