import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";
import type { Localization } from "../../ports/localization/localization.js";

type MasterDataInput = {
  accounts: Account[];
  categories: Category[];
  ownerContexts: OwnerContextLabel[];
  accountError?: string;
  categoryError?: string;
  ownerContextError?: string;
};

function masterDataText(localization: Localization) {
  const text = (key: string) => localization.text(key);
  return {
    newAccountName: text("master.newAccountName"),
    newAccountOwner: text("master.accountOwner"),
    addAccount: text("master.addAccount"),
    name: text("common.name"),
    owner: text("common.owner"),
    status: text("common.status"),
    actions: text("common.actions"),
    editAccount: text("master.editAccount"),
    deactivateAccount: text("master.deactivateAccount"),
    ownerContextsHeading: text("master.ownerContexts"),
    ownerKey: text("master.ownerKey"),
    displayName: text("master.displayName"),
    newCategoryName: text("master.newCategoryName"),
    addCategory: text("master.addCategory"),
    editCategory: text("master.editCategory"),
    deactivateCategory: text("master.deactivateCategory"),
    accountEditHeading: text("master.editAccount"),
    accountName: text("master.accountName"),
    accountOwner: text("master.accountOwner"),
    active: text("common.active"),
    saveAccount: text("master.saveAccount"),
    categoryEditHeading: text("master.editCategory"),
    categoryName: text("master.categoryName"),
    saveCategory: text("master.saveCategory"),
  };
}

export function prepareMasterDataViewModel(input: MasterDataInput, localization: Localization) {
  const ownerLabels = new Map(
    input.ownerContexts.map(({ ownerContext, label }) => [ownerContext, label]),
  );
  return {
    title: localization.text("master.title"),
    heading: localization.text("nav.masterData"),
    accountHeading: localization.text("master.accounts"),
    categoryHeading: localization.text("master.categories"),
    text: masterDataText(localization),
    accountError: input.accountError,
    categoryError: input.categoryError,
    ownerContextError: input.ownerContextError,
    ownerContexts: input.ownerContexts.map(({ ownerContext, label }) => ({
      value: ownerContext,
      label,
      formId: `owner-context-${ownerContext}-form`,
      actionUrl: `/admin/master-data/owner-contexts/${encodeURIComponent(ownerContext)}`,
      inputLabel: localization.text("master.ownerInput", { owner: ownerContext }),
      submitLabel: localization.text("master.ownerSave", { owner: ownerContext }),
    })),
    accounts: input.accounts.map((account) => ({
      name: account.name,
      ownerLabel: ownerLabels.get(account.ownerContext) ?? account.ownerContext,
      statusLabel: localization.text(account.active ? "common.enabled" : "common.disabled"),
      active: account.active,
      editUrl: `/admin/master-data/accounts/${encodeURIComponent(account.id)}/edit`,
      deactivateUrl: `/admin/master-data/accounts/${encodeURIComponent(account.id)}/deactivate`,
    })),
    categories: input.categories.map((category) => ({
      name: category.name,
      statusLabel: localization.text(category.active ? "common.enabled" : "common.disabled"),
      active: category.active,
      editUrl: `/admin/master-data/categories/${encodeURIComponent(category.id)}/edit`,
      deactivateUrl: `/admin/master-data/categories/${encodeURIComponent(category.id)}/deactivate`,
    })),
  };
}

export function prepareAccountEditViewModel(
  input: { account: Account; ownerContexts: OwnerContextLabel[]; formError?: string },
  localization: Localization,
) {
  return {
    title: localization.text("master.editAccount"),
    heading: localization.text("master.editAccount"),
    text: masterDataText(localization),
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

export function prepareCategoryEditViewModel(
  input: { category: Category; formError?: string },
  localization: Localization,
) {
  return {
    title: localization.text("master.editCategory"),
    heading: localization.text("master.editCategory"),
    text: masterDataText(localization),
    actionUrl: `/admin/master-data/categories/${encodeURIComponent(input.category.id)}`,
    name: input.category.name,
    activeChecked: input.category.active,
    formError: input.formError,
  };
}
