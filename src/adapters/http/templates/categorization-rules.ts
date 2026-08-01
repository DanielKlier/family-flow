import type { Category } from "../../../core/categories/category.js";
import type { CategorizationRule } from "../../../core/categorization/categorization-rule.js";
import { escapeHtml, renderNavigation, renderPage } from "./html.js";

export function renderCategorizationRulesPage(input: {
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
      { href: "/imports/csv", label: "CSV Import" },
      { href: "/admin/master-data", label: "Master Data" },
    ]),
    body: `${renderRuleForm(input.categories, input.formError)}${renderRuleList(input.rules, input.categories)}`,
  });
}

function renderRuleForm(categories: Category[], formError?: string): string {
  return `<section class="panel" aria-labelledby="categorization-rule-form-heading">
    <h2 id="categorization-rule-form-heading">Add categorization rule</h2>
    ${formError === undefined ? "" : `<p class="form-error">${escapeHtml(formError)}</p>`}
    <form id="categorization-rule-form" class="grid-form" method="post" action="/categorization-rules">
      <label class="field">Rule name <input name="name" required></label>
      <label class="field">Search text <input name="searchText" required></label>
      <label class="field">Rule category
        <select name="categoryId">${categories.map((category) => renderOption(category.id, category.name)).join("")}</select>
      </label>
      <label class="field">Priority <input name="priority" type="number" min="0" step="1" value="100" required></label>
      <button type="submit">Add rule</button>
    </form>
  </section>`;
}

function renderRuleList(rules: CategorizationRule[], categories: Category[]): string {
  return `<section class="panel" aria-labelledby="categorization-rules-list-heading">
    <h2 id="categorization-rules-list-heading">Rule list</h2>
    ${rules.length === 0 ? '<p class="empty-state">No categorization rules found.</p>' : renderRuleTable(rules, categories)}
  </section>`;
}

function renderRuleTable(rules: CategorizationRule[], categories: Category[]): string {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Search text</th><th>Category</th><th>Priority</th><th>Status</th></tr></thead>
    <tbody>${rules.map((rule) => renderRuleRow(rule, categories)).join("")}</tbody>
  </table></div>`;
}

function renderRuleRow(rule: CategorizationRule, categories: Category[]): string {
  return `<tr>
    <td>${escapeHtml(rule.name)}</td>
    <td>${escapeHtml(rule.searchText)}</td>
    <td>${escapeHtml(categories.find((category) => category.id === rule.categoryId)?.name ?? rule.categoryId)}</td>
    <td>${rule.priority}</td>
    <td>${rule.enabled ? "enabled" : "disabled"}</td>
  </tr>`;
}

function renderOption(value: string, label: string): string {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}
