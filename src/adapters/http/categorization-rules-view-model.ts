import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { CategorizationRule } from "../../core/categorization/categorization-rule.js";

type RulesInput = {
  accounts: Account[];
  categories: Category[];
  rules: CategorizationRule[];
  formError?: string;
};

function fixedCostValue(value: boolean | null): string {
  if (value === true) return "fixed";
  if (value === false) return "variable";
  return "unchanged";
}

function fixedCostLabel(value: boolean | null): string {
  if (value === true) return "mark fixed";
  if (value === false) return "mark variable";
  return "leave unchanged";
}

const categorizationRuleText = {
  name: "Rule name",
  searchText: "Search text",
  category: "Rule category",
  account: "Rule account",
  fixedCostAction: "Fixed cost action",
  priority: "Priority",
  listHeading: "Rule list",
  apply: "Apply rules to existing transactions",
  empty: "No categorization rules found.",
  categoryColumn: "Category",
  accountColumn: "Account",
  fixedCostColumn: "Fixed cost",
  status: "Status",
  actions: "Actions",
  edit: "Edit",
  delete: "Delete",
} as const;

function prepareForm(
  input: Pick<RulesInput, "accounts" | "categories">,
  rule?: CategorizationRule,
) {
  return {
    text: categorizationRuleText,
    heading: rule === undefined ? "Add categorization rule" : "Edit categorization rule",
    actionUrl:
      rule === undefined
        ? "/categorization-rules"
        : `/categorization-rules/${encodeURIComponent(rule.id)}`,
    submitLabel: rule === undefined ? "Add rule" : "Save rule",
    name: rule?.name ?? "",
    searchText: rule?.searchText ?? "",
    categories: input.categories.map(({ id, name }) => ({
      value: id,
      label: name,
      selected: id === rule?.categoryId,
    })),
    accounts: [
      { value: "", label: "All accounts", selected: rule?.accountId == null },
      ...input.accounts.map(({ id, name }) => ({
        value: id,
        label: name,
        selected: id === rule?.accountId,
      })),
    ],
    fixedCostOptions: [
      { value: "unchanged", label: "leave unchanged" },
      { value: "fixed", label: "mark fixed" },
      { value: "variable", label: "mark variable" },
    ].map((option) => ({
      ...option,
      selected: option.value === fixedCostValue(rule?.fixedCost ?? null),
    })),
    priority: rule?.priority ?? 100,
    enabledChecked: rule?.enabled ?? true,
  };
}

export function prepareCategorizationRulesViewModel(input: RulesInput) {
  const accounts = new Map(input.accounts.map(({ id, name }) => [id, name]));
  const categories = new Map(input.categories.map(({ id, name }) => [id, name]));
  return {
    title: "FamilyFlow Categorization Rules",
    heading: "Categorization Rules",
    text: categorizationRuleText,
    formError: input.formError,
    form: prepareForm(input),
    empty: input.rules.length === 0,
    rows: input.rules.map((rule) => ({
      name: rule.name,
      searchText: rule.searchText,
      category: categories.get(rule.categoryId) ?? rule.categoryId,
      account:
        rule.accountId === null ? "All accounts" : (accounts.get(rule.accountId) ?? rule.accountId),
      fixedCostLabel: fixedCostLabel(rule.fixedCost),
      priority: String(rule.priority),
      enabled: rule.enabled,
      statusLabel: rule.enabled ? "enabled" : "disabled",
      editUrl: `/categorization-rules/${encodeURIComponent(rule.id)}/edit`,
      deleteUrl: `/categorization-rules/${encodeURIComponent(rule.id)}/delete`,
    })),
  };
}

export function prepareCategorizationRuleEditViewModel(
  input: RulesInput & { rule: CategorizationRule },
) {
  return {
    title: "Edit Categorization Rule",
    ...prepareForm(input, input.rule),
    heading: "Edit Categorization Rule",
  };
}
