import { and, eq, gt, isNull } from "drizzle-orm";

import type {
  OidcTransaction,
  OidcTransactionStore,
} from "../../ports/auth/oidc-transaction-store.js";
import type { PostgresDatabase } from "./postgres.js";
import { oidcTransactions } from "./schema.js";

export class DrizzleOidcTransactionStore implements OidcTransactionStore {
  constructor(private readonly db: PostgresDatabase) {}

  async create(transaction: OidcTransaction): Promise<void> {
    await this.db.insert(oidcTransactions).values(transaction);
  }

  async consumeByState(state: string, consumedAt: Date): Promise<OidcTransaction | null> {
    const [row] = await this.db
      .update(oidcTransactions)
      .set({ consumedAt })
      .where(
        and(
          eq(oidcTransactions.state, state),
          isNull(oidcTransactions.consumedAt),
          gt(oidcTransactions.expiresAt, consumedAt),
        ),
      )
      .returning();
    return row ?? null;
  }
}
