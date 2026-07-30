import type { Account } from "../../../core/accounts/account.js";
import type { Category } from "../../../core/categories/category.js";
import type { OwnerContext } from "../../../core/shared/owner-context.js";
import type { Transaction } from "../../../core/transactions/transaction.js";
import type { TransactionFilters } from "../../../ports/repositories/transaction-repository.js";
import { escapeHtml, renderPage } from "./html.js";

export function renderTransactionsPage(input: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  filters: TransactionFilters;
}): string {
  return renderPage({
    title: "FamilyFlow Transactions",
    heading: "Transactions",
    navigation:
      '<nav class="app-nav"><a href="/">Dashboard</a><a href="/admin/master-data">Master Data</a></nav>',
    scripts: '<script src="/assets/htmx.min.js" defer></script>\n    ',
    body: renderTransactionsPanel(input),
  });
}

export function renderTransactionsPanel(input: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  filters: TransactionFilters;
  formError?: string;
}): string {
  return `<section id="transactions-panel">
    ${renderTransactionForm({ accounts: input.accounts, categories: input.categories, formError: input.formError })}
    ${renderTransactionFilters(input)}
    ${renderTransactionListSection(input.transactions)}
  </section>`;
}

export function renderTransactionEditPage(input: {
  accounts: Account[];
  categories: Category[];
  transaction: Transaction;
}): string {
  return renderPage({
    title: "Edit Transaction",
    heading: "Edit Transaction",
    navigation: '<nav class="app-nav"><a href="/transactions">Transactions</a></nav>',
    scripts: '<script src="/assets/htmx.min.js" defer></script>\n    ',
    body: renderTransactionForm(input),
  });
}

function renderTransactionForm(input: {
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction;
  formError?: string;
}): string {
  const transaction = input.transaction;
  const action =
    transaction === undefined
      ? "/transactions"
      : `/transactions/${encodeURIComponent(transaction.id)}`;
  const button = transaction === undefined ? "Add transaction" : "Save transaction";
  const htmxAttributes =
    transaction === undefined
      ? ' hx-post="/transactions" hx-target="#transactions-list" hx-swap="outerHTML"'
      : "";

  return `<section class="panel" aria-labelledby="transaction-form-heading">
    <h2 id="transaction-form-heading">${transaction === undefined ? "Add transaction" : "Edit transaction"}</h2>
    ${input.formError === undefined ? "" : `<p class="form-error">${escapeHtml(input.formError)}</p>`}
    <form id="transaction-form" class="grid-form" method="post" action="${action}"${htmxAttributes}>
    <label class="field">Transaction account
      <select name="accountId">${input.accounts.map((account) => renderOption(account.id, account.name, transaction?.accountId)).join("")}</select>
    </label>
    <label class="field">Category
      <select name="categoryId">${input.categories.map((category) => renderOption(category.id, category.name, transaction?.categoryId)).join("")}</select>
    </label>
    <label class="field">Date <input name="date" type="date" value="${escapeHtml(transaction?.date ?? "")}" required></label>
    <label class="field">Description <input name="description" value="${escapeHtml(transaction?.description ?? "")}" required></label>
    <label class="field">Payee <input name="payee" value="${escapeHtml(transaction?.payee ?? "")}"></label>
    <label class="field">Amount <input name="amount" inputmode="decimal" value="${escapeHtml(transaction === undefined ? "" : formatAmount(transaction.amountCents))}" required></label>
    <label class="field">Transaction status
      <select name="status">
        ${renderOption("booked", "booked", transaction?.status)}
        ${renderOption("planned", "planned", transaction?.status)}
      </select>
    </label>
    <label class="checkbox-field">Fixed cost <input name="fixedCost" type="checkbox" ${transaction?.fixedCost === true ? "checked" : ""}></label>
    <label class="field">Note <textarea name="note">${escapeHtml(transaction?.note ?? "")}</textarea></label>
    <button type="submit">${button}</button>
  </form>
  </section>`;
}

function renderTransactionFilters(input: {
  accounts: Account[];
  categories: Category[];
  filters: TransactionFilters;
}): string {
  return `<section class="panel" aria-labelledby="transaction-filters-heading">
    <h2 id="transaction-filters-heading">Filters</h2>
    <form id="transaction-filters" class="grid-form" method="get" action="/transactions" hx-get="/transactions" hx-target="#transactions-list" hx-swap="outerHTML">
    <label class="field">Month <input name="month" type="month" value="${escapeHtml(input.filters.month ?? "")}"></label>
    <label class="field">Filter account
      <select name="accountId"><option value="">All accounts</option>${input.accounts.map((account) => renderOption(account.id, account.name, input.filters.accountId)).join("")}</select>
    </label>
    <label class="field">Owner context
      <select name="ownerContext">
        <option value="">All owners</option>
        ${renderOption("person_a", "Person A", input.filters.ownerContext)}
        ${renderOption("person_b", "Person B", input.filters.ownerContext)}
        ${renderOption("shared", "Shared", input.filters.ownerContext)}
      </select>
    </label>
    <label class="field">Category
      <select name="categoryId"><option value="">All categories</option>${input.categories.map((category) => renderOption(category.id, category.name, input.filters.categoryId)).join("")}</select>
    </label>
    <label class="field">Filter status
      <select name="status"><option value="">All statuses</option>${renderOption("booked", "booked", input.filters.status)}${renderOption("planned", "planned", input.filters.status)}</select>
    </label>
    <button type="submit">Apply filters</button>
  </form>
  </section>`;
}

export function renderTransactionListSection(transactions: Transaction[]): string {
  return `<section id="transactions-list" class="panel" aria-labelledby="transactions-list-heading">
    <h2 id="transactions-list-heading">Transaction list</h2>
    ${renderTransactionList(transactions)}
  </section>`;
}

function renderTransactionList(transactions: Transaction[]): string {
  if (transactions.length === 0) {
    return '<p class="empty-state">No transactions found.</p>';
  }

  return `<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th>Fixed cost</th><th>Actions</th></tr></thead>
    <tbody>${transactions.map(renderTransactionRow).join("")}</tbody>
  </table></div>`;
}

function renderTransactionRow(transaction: Transaction): string {
  return `<tr>
    <td>${escapeHtml(transaction.date)}</td>
    <td>${escapeHtml(transaction.description)}</td>
    <td>${formatAmount(transaction.amountCents)}</td>
    <td>${escapeHtml(transaction.status)}</td>
    <td>${transaction.fixedCost ? "fixed" : "variable"}</td>
    <td>
      <a href="/transactions/${encodeURIComponent(transaction.id)}/edit">Edit ${escapeHtml(transaction.description)}</a>
      <form class="inline-form" method="post" action="/transactions/${encodeURIComponent(transaction.id)}/delete" hx-post="/transactions/${encodeURIComponent(transaction.id)}/delete" hx-target="#transactions-list" hx-swap="outerHTML">
        <button type="submit">Delete ${escapeHtml(transaction.description)}</button>
      </form>
    </td>
  </tr>`;
}

function renderOption(
  value: string,
  label: string,
  selectedValue: string | OwnerContext | undefined,
): string {
  return `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function formatAmount(amountCents: number): string {
  return (Math.abs(amountCents) / 100).toFixed(2);
}
