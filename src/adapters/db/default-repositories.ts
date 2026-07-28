import {
  initialAccounts,
  initialCategories,
  type MasterDataRepositories,
} from "./seeds/master-data.js";
import { InMemoryAccountRepository } from "./in-memory-account-repository.js";
import { InMemoryCategoryRepository } from "./in-memory-category-repository.js";

export function createSeededInMemoryRepositories(): MasterDataRepositories {
  return {
    accounts: new InMemoryAccountRepository(initialAccounts),
    categories: new InMemoryCategoryRepository(initialCategories),
  };
}
