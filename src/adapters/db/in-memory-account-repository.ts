import type { Account } from "../../core/accounts/account.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";

export class InMemoryAccountRepository implements AccountRepository {
  readonly #accounts = new Map<string, Account>();

  constructor(accounts: Account[] = []) {
    for (const account of accounts) {
      this.#accounts.set(account.id, account);
    }
  }

  async list(): Promise<Account[]> {
    return [...this.#accounts.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async save(account: Account): Promise<void> {
    this.#accounts.set(account.id, account);
  }
}
