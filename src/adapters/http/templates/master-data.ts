import type { Account } from "../../../core/accounts/account.js";
import type { Category } from "../../../core/categories/category.js";
import { escapeHtml, renderNavigation, renderPage } from "./html.js";

export function renderMasterDataPage(input: {
  accounts: Account[];
  categories: Category[];
  accountError?: string;
  categoryError?: string;
}): string {
  return renderPage({
    title: "FamilyFlow Master Data",
    heading: "Master Data",
    navigation: renderMasterDataNavigation(),
    body: `<section class="panel" aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Accounts</h2>
        ${renderAccountCreateForm(input.accountError)}
        ${renderAccountTable(input.accounts)}
      </section>
      <section class="panel" aria-labelledby="categories-heading">
        <h2 id="categories-heading">Categories</h2>
        ${renderCategoryCreateForm(input.categoryError)}
        ${renderCategoryTable(input.categories)}
      </section>`,
  });
}

export function renderAccountEditPage(account: Account, formError?: string): string {
  return renderPage({
    title: "Edit Account",
    heading: "Edit Account",
    navigation: renderNavigation([{ href: "/admin/master-data", label: "Master Data" }]),
    body: `<section class="panel" aria-labelledby="account-edit-heading">
      <h2 id="account-edit-heading">Edit account</h2>
      ${formError === undefined ? "" : `<p class="form-error">${escapeHtml(formError)}</p>`}
      <form class="grid-form" method="post" action="/admin/master-data/accounts/${encodeURIComponent(account.id)}">
        <label class="field">Account name <input name="name" value="${escapeHtml(account.name)}" required></label>
        <label class="field">Account owner
          <select name="ownerContext">
            ${renderOption("person_a", "Person A", account.ownerContext)}
            ${renderOption("person_b", "Person B", account.ownerContext)}
            ${renderOption("shared", "Shared", account.ownerContext)}
          </select>
        </label>
        <label class="checkbox-field">Active <input name="active" type="checkbox" ${account.active ? "checked" : ""}></label>
        <button type="submit">Save account</button>
      </form>
    </section>`,
  });
}

export function renderCategoryEditPage(category: Category, formError?: string): string {
  return renderPage({
    title: "Edit Category",
    heading: "Edit Category",
    navigation: renderNavigation([{ href: "/admin/master-data", label: "Master Data" }]),
    body: `<section class="panel" aria-labelledby="category-edit-heading">
      <h2 id="category-edit-heading">Edit category</h2>
      ${formError === undefined ? "" : `<p class="form-error">${escapeHtml(formError)}</p>`}
      <form class="grid-form" method="post" action="/admin/master-data/categories/${encodeURIComponent(category.id)}">
        <label class="field">Category name <input name="name" value="${escapeHtml(category.name)}" required></label>
        <label class="checkbox-field">Active <input name="active" type="checkbox" ${category.active ? "checked" : ""}></label>
        <button type="submit">Save category</button>
      </form>
    </section>`,
  });
}

function renderMasterDataNavigation(): string {
  return renderNavigation([
    { href: "/", label: "Dashboard" },
    { href: "/transactions", label: "Transactions" },
    { href: "/imports/csv", label: "CSV Import" },
    { href: "/categorization-rules", label: "Rules" },
  ]);
}

function renderAccountCreateForm(formError: string | undefined): string {
  return `<form class="grid-form" method="post" action="/admin/master-data/accounts">
    ${formError === undefined ? "" : `<p class="form-error">${escapeHtml(formError)}</p>`}
    <label class="field">New account name <input name="name" required></label>
    <label class="field">New account owner
      <select name="ownerContext">
        <option value="person_a">Person A</option>
        <option value="person_b">Person B</option>
        <option value="shared">Shared</option>
      </select>
    </label>
    <button type="submit">Add account</button>
  </form>`;
}

function renderAccountTable(accounts: Account[]): string {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${accounts.map(renderAccountRow).join("")}</tbody>
  </table></div>`;
}

function renderAccountRow(account: Account): string {
  return `<tr>
    <td>${escapeHtml(account.name)}</td>
    <td>${escapeHtml(account.ownerContext)}</td>
    <td>${account.active ? "active" : "inactive"}</td>
    <td class="actions-cell">
      <a class="action-link" href="/admin/master-data/accounts/${encodeURIComponent(account.id)}/edit">Edit account</a>
      ${account.active ? renderDeactivateForm("account", account.id) : ""}
    </td>
  </tr>`;
}

function renderCategoryCreateForm(formError: string | undefined): string {
  return `<form class="grid-form" method="post" action="/admin/master-data/categories">
    ${formError === undefined ? "" : `<p class="form-error">${escapeHtml(formError)}</p>`}
    <label class="field">New category name <input name="name" required></label>
    <button type="submit">Add category</button>
  </form>`;
}

function renderCategoryTable(categories: Category[]): string {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${categories.map(renderCategoryRow).join("")}</tbody>
  </table></div>`;
}

function renderCategoryRow(category: Category): string {
  return `<tr>
    <td>${escapeHtml(category.name)}</td>
    <td>${category.active ? "active" : "inactive"}</td>
    <td class="actions-cell">
      <a class="action-link" href="/admin/master-data/categories/${encodeURIComponent(category.id)}/edit">Edit category</a>
      ${category.active ? renderDeactivateForm("category", category.id) : ""}
    </td>
  </tr>`;
}

function renderDeactivateForm(kind: "account" | "category", id: string): string {
  const plural = kind === "account" ? "accounts" : "categories";
  const label = kind === "account" ? "Deactivate account" : "Deactivate category";

  return `<form class="inline-form" method="post" action="/admin/master-data/${plural}/${encodeURIComponent(id)}/deactivate">
    <button class="link-button" type="submit">${label}</button>
  </form>`;
}

function renderOption(value: string, label: string, selectedValue: string): string {
  return `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}
