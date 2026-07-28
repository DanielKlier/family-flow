import type { Account } from "../../core/accounts/account.js";

export type AccountRepository = {
  list(): Promise<Account[]>;
  save(account: Account): Promise<void>;
};
