import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { CategorizationRule } from "../../core/categorization/categorization-rule.js";
import type { Localization } from "../../ports/localization/localization.js";

type RulesInput = {
  accounts: Account[];
  categories: Category[];
  rules: CategorizationRule[];
  formError?: string;
  applicationResult?: { changed: number; unchanged: number };
};

function actionValue(value: boolean | null, truthy: string, falsy: string): string {
  return value === true ? truthy : value === false ? falsy : "unchanged";
}
function actionLabel(
  value: boolean | null,
  localization: Localization,
  truthy: string,
  falsy: string,
): string {
  return localization.text(value === true ? truthy : value === false ? falsy : "common.unchanged");
}
function ruleText(localization: Localization) {
  const text = (key: string) => localization.text(key);
  return {
    name: text("rules.ruleName"),
    searchText: text("rules.searchText"),
    category: text("common.category"),
    account: text("common.account"),
    fixedCostAction: text("rules.fixedAction"),
    internalTransferAction: text("rules.transferAction"),
    priority: text("rules.priority"),
    listHeading: text("rules.list"),
    apply: text("rules.apply"),
    empty: text("rules.empty"),
    categoryColumn: text("common.category"),
    accountColumn: text("common.account"),
    fixedCostColumn: text("rules.fixedColumn"),
    internalTransferColumn: text("rules.transferColumn"),
    status: text("common.status"),
    actions: text("common.actions"),
    edit: text("common.edit"),
    delete: text("common.delete"),
  };
}

function prepareForm(
  input: Pick<RulesInput, "accounts" | "categories">,
  localization: Localization,
  rule?: CategorizationRule,
) {
  const fixedValue = actionValue(rule?.fixedCost ?? null, "fixed", "variable");
  const transferValue = actionValue(rule?.internalTransfer ?? null, "mark", "unmark");
  return {
    text: ruleText(localization),
    heading: localization.text(rule === undefined ? "rules.add" : "rules.edit"),
    actionUrl:
      rule === undefined
        ? "/categorization-rules"
        : `/categorization-rules/${encodeURIComponent(rule.id)}`,
    submitLabel: localization.text(rule === undefined ? "rules.addSubmit" : "rules.save"),
    name: rule?.name ?? "",
    searchText: rule?.searchText ?? "",
    categories: input.categories.map(({ id, name }) => ({
      value: id,
      label: name,
      selected: id === rule?.categoryId,
    })),
    accounts: [
      {
        value: "",
        label: localization.text("common.allAccounts"),
        selected: rule?.accountId == null,
      },
      ...input.accounts.map(({ id, name }) => ({
        value: id,
        label: name,
        selected: id === rule?.accountId,
      })),
    ],
    fixedCostOptions: [
      { value: "unchanged", label: localization.text("common.unchanged") },
      { value: "fixed", label: localization.text("rules.markFixed") },
      { value: "variable", label: localization.text("rules.markVariable") },
    ].map((option) => ({ ...option, selected: option.value === fixedValue })),
    internalTransferOptions: [
      { value: "unchanged", label: localization.text("common.unchanged") },
      { value: "mark", label: localization.text("rules.markTransfer") },
      { value: "unmark", label: localization.text("rules.unmarkTransfer") },
    ].map((option) => ({ ...option, selected: option.value === transferValue })),
    priority: rule?.priority ?? 100,
    enabledChecked: rule?.enabled ?? true,
  };
}

export function prepareCategorizationRulesViewModel(input: RulesInput, localization: Localization) {
  const accounts = new Map(input.accounts.map(({ id, name }) => [id, name]));
  const categories = new Map(input.categories.map(({ id, name }) => [id, name]));
  return {
    title: localization.text("rules.title"),
    heading: localization.text("rules.heading"),
    text: ruleText(localization),
    formError: input.formError,
    applicationResult:
      input.applicationResult === undefined
        ? undefined
        : localization.text("rules.applyResult", {
            changed: input.applicationResult.changed,
            unchanged: input.applicationResult.unchanged,
          }),
    form: prepareForm(input, localization),
    empty: input.rules.length === 0,
    rows: input.rules.map((rule) => ({
      name: rule.name,
      searchText: rule.searchText,
      category: categories.get(rule.categoryId) ?? rule.categoryId,
      account:
        rule.accountId === null
          ? localization.text("common.allAccounts")
          : (accounts.get(rule.accountId) ?? rule.accountId),
      fixedCostLabel: actionLabel(
        rule.fixedCost,
        localization,
        "rules.markFixed",
        "rules.markVariable",
      ),
      internalTransferLabel: actionLabel(
        rule.internalTransfer,
        localization,
        "rules.markTransfer",
        "rules.unmarkTransfer",
      ),
      priority: String(rule.priority),
      enabled: rule.enabled,
      statusLabel: localization.text(rule.enabled ? "common.enabled" : "common.disabled"),
      editUrl: `/categorization-rules/${encodeURIComponent(rule.id)}/edit`,
      deleteUrl: `/categorization-rules/${encodeURIComponent(rule.id)}/delete`,
    })),
  };
}

export function prepareCategorizationRuleEditViewModel(
  input: RulesInput & { rule: CategorizationRule },
  localization: Localization,
) {
  return {
    title: localization.text("rules.edit"),
    ...prepareForm(input, localization, input.rule),
    heading: localization.text("rules.edit"),
    formError: input.formError,
  };
}
