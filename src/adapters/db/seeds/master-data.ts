import { createAccount, type Account } from "../../../core/accounts/account.js";
import { createCategory, type Category } from "../../../core/categories/category.js";
import { type OwnerContextLabel, ownerContexts } from "../../../core/shared/owner-context.js";
import type { MasterDataNameProvider } from "../../../ports/localization/localization.js";
import type { AccountRepository } from "../../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../../ports/repositories/category-repository.js";
import type { OwnerContextRepository } from "../../../ports/repositories/owner-context-repository.js";

const accountInventory = [
  { id: "account-person-a-checking", ownerContext: "person_a" },
  { id: "account-person-b-checking", ownerContext: "person_b" },
  { id: "account-shared-checking", ownerContext: "shared" },
] as const;
const categoryInventory = [
  "category-housing-rent",
  "category-groceries",
  "category-drugstore",
  "category-insurance",
  "category-mobility",
  "category-health",
  "category-child-baby",
  "category-subscriptions",
  "category-leisure",
  "category-vacation",
  "category-clothing",
  "category-other",
] as const;

export type MasterDataRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
  ownerContexts: OwnerContextRepository;
};

export async function seedMasterData(
  repositories: MasterDataRepositories,
  names: MasterDataNameProvider,
): Promise<void> {
  for (const label of createInitialOwnerContexts(names)) {
    if ((await repositories.ownerContexts.get(label.ownerContext)) === null) {
      await repositories.ownerContexts.save(label);
    }
  }
  for (const account of createInitialAccounts(names)) {
    if ((await repositories.accounts.get(account.id)) === null) {
      await repositories.accounts.save(account);
    }
  }
  for (const category of createInitialCategories(names)) {
    if ((await repositories.categories.get(category.id)) === null) {
      await repositories.categories.save(category);
    }
  }
}

export function createInitialOwnerContexts(names: MasterDataNameProvider): OwnerContextLabel[] {
  return ownerContexts.map((ownerContext) => ({
    ownerContext,
    label: names.seedName("ownerContext", ownerContext),
  }));
}

export function createInitialAccounts(names: MasterDataNameProvider): Account[] {
  return accountInventory.map(({ id, ownerContext }) =>
    createAccount({ id, ownerContext, name: names.seedName("account", id) }),
  );
}

export function createInitialCategories(names: MasterDataNameProvider): Category[] {
  return categoryInventory.map((id) =>
    createCategory({ id, name: names.seedName("category", id) }),
  );
}
