import type { UserContext } from "./user-context.js";

export type SessionRecord = {
  id: string;
  tokenHash: string;
  user: UserContext;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface SessionStore {
  create(record: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revoke(tokenHash: string, revokedAt: Date): Promise<boolean>;
  deleteEligible(now: Date, limit: number): Promise<number>;
  revokeAll(revokedAt: Date): Promise<number>;
}
