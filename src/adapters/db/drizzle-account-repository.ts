import { asc } from "drizzle-orm";

import { createAccount, type Account } from "../../core/accounts/account.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { PostgresDatabase } from "./postgres.js";
import { accounts } from "./schema.js";

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async list(): Promise<Account[]> {
    const rows = await this.db.select().from(accounts).orderBy(asc(accounts.name));

    return rows.map((row) =>
      createAccount({
        id: row.id,
        name: row.name,
        ownerContext: row.ownerContext,
      }),
    );
  }

  async save(account: Account): Promise<void> {
    await this.db
      .insert(accounts)
      .values(account)
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          name: account.name,
          ownerContext: account.ownerContext,
        },
      });
  }
}
