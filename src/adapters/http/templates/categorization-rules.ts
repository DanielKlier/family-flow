import type { Account } from "../../../core/accounts/account.js";
import type { Category } from "../../../core/categories/category.js";
import type { CategorizationRule } from "../../../core/categorization/categorization-rule.js";
import { escapeHtml, renderNavigation, renderPage } from "./html.js";

export function renderCategorizationRulesPage(input: {
  accounts: Account[];
  categories: Category[];
  rules: CategorizationRule[];
  formError?: string;
}): string {
  return renderPage({
    title: "FamilyFlow Categorization Rules",
    heading: "Categorization Rules",
    navigation: renderNavigation([
      { href: "/", label: "Dashboard" },
      { href: "/transactions", label: "Transactions" },
      { href: "/income", label: "Income" },
      { href: "/imports/csv", label: "CSV Import" },
      { href: "/admin/master-data", label: "Master Data" },
    ]),
    body: `${renderRuleForm(input.accounts, input.categories, input.formError)}${renderRuleList(input.rules, input.accounts, input.categories)}`,
  });
}

export function renderCategorizationRuleEditPage(input: {
  accounts: Account[];
  categories: Category[];
  rule: CategorizationRule;
}): string {
  return renderPage({
    title: "Edit Categorization Rule",
    heading: "Edit Categorization Rule",
    navigation: renderNavigation([{ href: "/categorization-rules", label: "Rules" }]),
    body: renderRuleForm(input.accounts, input.categories, undefined, input.rule),
  });
}

function renderRuleForm(
  accounts: Account[],
  categories: Category[],
  formError?: string,
  rule?: CategorizationRule,
): string {
  const action = rule === undefined ? "/categorization-rules" : `/categorization-rules/${rule.id}`;
  const heading = rule === undefined ? "Add categorization rule" : "Edit categorization rule";
  const button = rule === undefined ? "Add rule" : "Save rule";

  return `<section class="panel" aria-labelledby="categorization-rule-form-heading">
    <h2 id="categorization-rule-form-heading">${heading}</h2>
    ${formError === undefined ? "" : `<p class="form-error">${escapeHtml(formError)}</p>`}
    <form id="categorization-rule-form" class="grid-form" method="post" action="${escapeHtml(action)}">
      <label class="field">Rule name <input name="name" value="${escapeHtml(rule?.name ?? "")}" required></label>
      <label class="field">Search text <input name="searchText" value="${escapeHtml(rule?.searchText ?? "")}" required></label>
      <label class="field">Rule category
        <select name="categoryId">${categories.map((category) => renderOption(category.id, category.name, rule?.categoryId)).join("")}</select>
      </label>
      <label class="field">Rule account
        <select name="accountId"><option value="" ${rule?.accountId === null ? "selected" : ""}>All accounts</option>${accounts.map((account) => renderOption(account.id, account.name, rule?.accountId ?? undefined)).join("")}</select>
      </label>
      <label class="field">Fixed cost action
        <select name="fixedCost">
          ${renderOption("unchanged", "leave unchanged", renderFixedCostValue(rule?.fixedCost ?? null))}
          ${renderOption("fixed", "mark fixed", renderFixedCostValue(rule?.fixedCost ?? null))}
          ${renderOption("variable", "mark variable", renderFixedCostValue(rule?.fixedCost ?? null))}
        </select>
      </label>
      <label class="field">Priority <input name="priority" type="number" min="0" step="1" value="${rule?.priority ?? 100}" required></label>
      <button type="submit">${button}</button>
    </form>
  </section>`;
}

function renderRuleList(
  rules: CategorizationRule[],
  accounts: Account[],
  categories: Category[],
): string {
  return `<section class="panel" aria-labelledby="categorization-rules-list-heading">
    <h2 id="categorization-rules-list-heading">Rule list</h2>
    <form class="inline-form" method="post" action="/categorization-rules/apply">
      <button type="submit">Apply rules to existing transactions</button>
    </form>
    ${rules.length === 0 ? '<p class="empty-state">No categorization rules found.</p>' : renderRuleTable(rules, accounts, categories)}
  </section>`;
}

function renderRuleTable(
  rules: CategorizationRule[],
  accounts: Account[],
  categories: Category[],
): string {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Search text</th><th>Category</th><th>Account</th><th>Fixed cost</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rules.map((rule) => renderRuleRow(rule, accounts, categories)).join("")}</tbody>
  </table></div>`;
}

function renderRuleRow(
  rule: CategorizationRule,
  accounts: Account[],
  categories: Category[],
): string {
  return `<tr>
    <td>${escapeHtml(rule.name)}</td>
    <td>${escapeHtml(rule.searchText)}</td>
    <td>${escapeHtml(categories.find((category) => category.id === rule.categoryId)?.name ?? rule.categoryId)}</td>
    <td>${escapeHtml(rule.accountId === null ? "All accounts" : (accounts.find((account) => account.id === rule.accountId)?.name ?? rule.accountId))}</td>
    <td>${escapeHtml(renderFixedCostLabel(rule.fixedCost))}</td>
    <td>${rule.priority}</td>
    <td>${rule.enabled ? "enabled" : "disabled"}</td>
    <td class="actions-cell">
      <a class="action-link" href="/categorization-rules/${encodeURIComponent(rule.id)}/edit">Edit</a>
      <form class="inline-form" method="post" action="/categorization-rules/${encodeURIComponent(rule.id)}/delete">
        <button class="link-button" type="submit">Delete</button>
      </form>
    </td>
  </tr>`;
}

function renderOption(value: string, label: string, selectedValue?: string): string {
  return `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderFixedCostValue(fixedCost: boolean | null): string {
  if (fixedCost === true) {
    return "fixed";
  }
  if (fixedCost === false) {
    return "variable";
  }

  return "unchanged";
}

function renderFixedCostLabel(fixedCost: boolean | null): string {
  if (fixedCost === true) {
    return "mark fixed";
  }
  if (fixedCost === false) {
    return "mark variable";
  }

  return "leave unchanged";
}
