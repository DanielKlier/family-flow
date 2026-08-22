import type { MasterDataNameProvider } from "../../ports/localization/localization.js";
import {
  createInitialAccounts,
  createInitialCategories,
  createInitialOwnerContexts,
  type MasterDataRepositories,
} from "./seeds/master-data.js";
import { InMemoryAccountRepository } from "./in-memory-account-repository.js";
import { InMemoryCategorizationRuleRepository } from "./in-memory-categorization-rule-repository.js";
import { InMemoryCategoryRepository } from "./in-memory-category-repository.js";
import { InMemoryImportProfileRepository } from "./in-memory-import-profile-repository.js";
import { InMemoryIncomeRepository } from "./in-memory-income-repository.js";
import { InMemoryOwnerContextRepository } from "./in-memory-owner-context-repository.js";
import { InMemoryScenarioRepository } from "./in-memory-scenario-repository.js";
import { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";
import { initialImportProfiles, type ImportProfileRepositories } from "./seeds/import-profiles.js";

export function createSeededInMemoryRepositories(
  names: MasterDataNameProvider,
): MasterDataRepositories &
  ImportProfileRepositories & {
    categorizationRules: InMemoryCategorizationRuleRepository;
    income: InMemoryIncomeRepository;
    scenarios: InMemoryScenarioRepository;
    transactions: InMemoryTransactionRepository;
  } {
  const accounts = createInitialAccounts(names);
  const categories = createInitialCategories(names);
  return {
    accounts: new InMemoryAccountRepository(accounts),
    categories: new InMemoryCategoryRepository(categories),
    categorizationRules: new InMemoryCategorizationRuleRepository(),
    income: new InMemoryIncomeRepository(),
    importProfiles: new InMemoryImportProfileRepository(initialImportProfiles),
    ownerContexts: new InMemoryOwnerContextRepository(createInitialOwnerContexts(names)),
    scenarios: new InMemoryScenarioRepository(),
    transactions: new InMemoryTransactionRepository(accounts),
  };
}
