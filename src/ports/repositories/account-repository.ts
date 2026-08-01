import type { Account } from "../../core/accounts/account.js";

export type AccountRepository = {
  list(): Promise<Account[]>;
  listActive(): Promise<Account[]>;
  get(id: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
};
