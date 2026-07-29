import {
  initialAccounts,
  initialCategories,
  type MasterDataRepositories,
} from "./seeds/master-data.js";
import { InMemoryAccountRepository } from "./in-memory-account-repository.js";
import { InMemoryCategoryRepository } from "./in-memory-category-repository.js";
import { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";

export function createSeededInMemoryRepositories(): MasterDataRepositories & {
  transactions: InMemoryTransactionRepository;
} {
  return {
    accounts: new InMemoryAccountRepository(initialAccounts),
    categories: new InMemoryCategoryRepository(initialCategories),
    transactions: new InMemoryTransactionRepository(initialAccounts),
  };
}
