import {
  initialAccounts,
  initialCategories,
  type MasterDataRepositories,
} from "./seeds/master-data.js";
import { InMemoryAccountRepository } from "./in-memory-account-repository.js";
import { InMemoryCategoryRepository } from "./in-memory-category-repository.js";
import { InMemoryImportProfileRepository } from "./in-memory-import-profile-repository.js";
import { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";
import { initialImportProfiles, type ImportProfileRepositories } from "./seeds/import-profiles.js";

export function createSeededInMemoryRepositories(): MasterDataRepositories &
  ImportProfileRepositories & {
    transactions: InMemoryTransactionRepository;
  } {
  return {
    accounts: new InMemoryAccountRepository(initialAccounts),
    categories: new InMemoryCategoryRepository(initialCategories),
    importProfiles: new InMemoryImportProfileRepository(initialImportProfiles),
    transactions: new InMemoryTransactionRepository(initialAccounts),
  };
}
