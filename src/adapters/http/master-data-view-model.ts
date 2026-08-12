import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";

type MasterDataInput = {
  accounts: Account[];
  categories: Category[];
  ownerContexts: OwnerContextLabel[];
  accountError?: string;
  categoryError?: string;
  ownerContextError?: string;
};

const masterDataText = {
  newAccountName: "New account name",
  newAccountOwner: "New account owner",
  addAccount: "Add account",
  name: "Name",
  owner: "Owner",
  status: "Status",
  actions: "Actions",
  editAccount: "Edit account",
  deactivateAccount: "Deactivate account",
  ownerContextsHeading: "Account owners",
  ownerKey: "Owner key",
  displayName: "Display name",
  newCategoryName: "New category name",
  addCategory: "Add category",
  editCategory: "Edit category",
  deactivateCategory: "Deactivate category",
  accountEditHeading: "Edit account",
  accountName: "Account name",
  accountOwner: "Account owner",
  active: "Active",
  saveAccount: "Save account",
  categoryEditHeading: "Edit category",
  categoryName: "Category name",
  saveCategory: "Save category",
} as const;

export function prepareMasterDataViewModel(input: MasterDataInput) {
  const ownerLabels = new Map(
    input.ownerContexts.map(({ ownerContext, label }) => [ownerContext, label]),
  );
  return {
    title: "FamilyFlow Master Data",
    heading: "Master Data",
    accountHeading: "Accounts",
    categoryHeading: "Categories",
    text: masterDataText,
    accountError: input.accountError,
    categoryError: input.categoryError,
    ownerContextError: input.ownerContextError,
    ownerContexts: input.ownerContexts.map(({ ownerContext, label }) => ({
      value: ownerContext,
      label,
      formId: `owner-context-${ownerContext}-form`,
      actionUrl: `/admin/master-data/owner-contexts/${encodeURIComponent(ownerContext)}`,
      inputLabel: `Owner name for ${ownerContext}`,
      submitLabel: `Save owner name for ${ownerContext}`,
    })),
    accounts: input.accounts.map((account) => ({
      name: account.name,
      ownerLabel: ownerLabels.get(account.ownerContext) ?? account.ownerContext,
      statusLabel: account.active ? "active" : "inactive",
      active: account.active,
      editUrl: `/admin/master-data/accounts/${encodeURIComponent(account.id)}/edit`,
      deactivateUrl: `/admin/master-data/accounts/${encodeURIComponent(account.id)}/deactivate`,
    })),
    categories: input.categories.map((category) => ({
      name: category.name,
      statusLabel: category.active ? "active" : "inactive",
      active: category.active,
      editUrl: `/admin/master-data/categories/${encodeURIComponent(category.id)}/edit`,
      deactivateUrl: `/admin/master-data/categories/${encodeURIComponent(category.id)}/deactivate`,
    })),
  };
}

export function prepareAccountEditViewModel(input: {
  account: Account;
  ownerContexts: OwnerContextLabel[];
  formError?: string;
}) {
  return {
    title: "Edit Account",
    heading: "Edit Account",
    text: masterDataText,
    actionUrl: `/admin/master-data/accounts/${encodeURIComponent(input.account.id)}`,
    name: input.account.name,
    activeChecked: input.account.active,
    formError: input.formError,
    ownerContexts: input.ownerContexts.map(({ ownerContext, label }) => ({
      value: ownerContext,
      label,
      selected: ownerContext === input.account.ownerContext,
    })),
  };
}

export function prepareCategoryEditViewModel(input: { category: Category; formError?: string }) {
  return {
    title: "Edit Category",
    heading: "Edit Category",
    text: masterDataText,
    actionUrl: `/admin/master-data/categories/${encodeURIComponent(input.category.id)}`,
    name: input.category.name,
    activeChecked: input.category.active,
    formError: input.formError,
  };
}
