import { createAccount, type Account } from "../../../core/accounts/account.js";
import { createCategory, type Category } from "../../../core/categories/category.js";
import type { AccountRepository } from "../../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../../ports/repositories/category-repository.js";

export const initialAccounts: Account[] = [
  createAccount({
    id: "account-person-a-checking",
    name: "Person A checking",
    ownerContext: "person_a",
  }),
  createAccount({
    id: "account-person-b-checking",
    name: "Person B checking",
    ownerContext: "person_b",
  }),
  createAccount({ id: "account-shared-checking", name: "Shared checking", ownerContext: "shared" }),
];

export const initialCategories: Category[] = [
  createCategory({ id: "category-housing-rent", name: "Wohnen/Miete" }),
  createCategory({ id: "category-groceries", name: "Lebensmittel" }),
  createCategory({ id: "category-drugstore", name: "Drogerie" }),
  createCategory({ id: "category-insurance", name: "Versicherungen" }),
  createCategory({ id: "category-mobility", name: "Mobilitaet" }),
  createCategory({ id: "category-health", name: "Gesundheit" }),
  createCategory({ id: "category-child-baby", name: "Kind/Baby" }),
  createCategory({ id: "category-subscriptions", name: "Abos" }),
  createCategory({ id: "category-leisure", name: "Freizeit" }),
  createCategory({ id: "category-vacation", name: "Urlaub" }),
  createCategory({ id: "category-clothing", name: "Kleidung" }),
  createCategory({ id: "category-other", name: "Sonstiges" }),
];

export type MasterDataRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
};

export async function seedMasterData(repositories: MasterDataRepositories): Promise<void> {
  for (const account of initialAccounts) {
    if ((await repositories.accounts.get(account.id)) === null) {
      await repositories.accounts.save(account);
    }
  }

  for (const category of initialCategories) {
    if ((await repositories.categories.get(category.id)) === null) {
      await repositories.categories.save(category);
    }
  }
}
