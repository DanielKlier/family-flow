import type { Account } from "../../core/accounts/account.js";
import { compareCodePoints } from "../../core/shared/compare-code-points.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";

export class InMemoryAccountRepository implements AccountRepository {
  readonly #accounts = new Map<string, Account>();

  constructor(accounts: Account[] = []) {
    for (const account of accounts) {
      this.#accounts.set(account.id, account);
    }
  }

  async list(): Promise<Account[]> {
    return sortAccounts([...this.#accounts.values()]);
  }

  async listActive(): Promise<Account[]> {
    return sortAccounts([...this.#accounts.values()].filter((account) => account.active));
  }

  async get(id: string): Promise<Account | null> {
    return this.#accounts.get(id) ?? null;
  }

  async save(account: Account): Promise<void> {
    this.#accounts.set(account.id, account);
  }
}

function sortAccounts(accounts: Account[]): Account[] {
  return accounts.sort((left, right) => compareCodePoints(left.name, right.name));
}
