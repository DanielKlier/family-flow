import type { Account } from "../../../core/accounts/account.js";
import type { Category } from "../../../core/categories/category.js";
import { escapeHtml, renderPage } from "./html.js";

export type CsvImportPreviewRow = {
  accountId: string;
  categoryId: string;
  categoryName: string;
  date: string;
  amountCents: number;
  description: string;
  payee: string | null;
  importHash: string;
  duplicate: boolean;
};

export function renderCsvImportPage(input: {
  accounts: Account[];
  categories: Category[];
  previewRows?: CsvImportPreviewRow[];
  formError?: string;
}): string {
  return renderPage({
    title: "CSV Import",
    heading: "CSV Import",
    navigation:
      '<nav class="app-nav"><a href="/">Dashboard</a><a href="/transactions">Transactions</a><a href="/admin/master-data">Master Data</a></nav>',
    body: `${renderCsvImportForm(input)}${renderPreview(input.previewRows)}`,
  });
}

function renderCsvImportForm(input: {
  accounts: Account[];
  categories: Category[];
  formError?: string;
}): string {
  return `<section class="panel" aria-labelledby="csv-import-form-heading">
    <h2 id="csv-import-form-heading">Upload CSV</h2>
    ${input.formError === undefined ? "" : `<p class="form-error">${escapeHtml(input.formError)}</p>`}
    <form id="csv-import-form" class="grid-form" method="post" action="/imports/csv/preview" enctype="multipart/form-data">
      <label class="field">Import account
        <select name="accountId">${input.accounts.map((account) => renderOption(account.id, account.name)).join("")}</select>
      </label>
      <label class="field">CSV encoding
        <select name="encoding">
          <option value="utf8">UTF-8</option>
          <option value="latin1">Latin1</option>
        </select>
      </label>
      <label class="field">Date column <input name="dateColumn" value="Date" required></label>
      <label class="field">Amount column <input name="amountColumn" value="Amount" required></label>
      <label class="field">Description column <input name="descriptionColumn" value="Description" required></label>
      <label class="field">Payee column <input name="payeeColumn" value="Payee"></label>
      <label class="field">Category column <input name="categoryColumn" value=""></label>
      <label class="field">CSV file <input name="csvFile" type="file" accept=".csv,text/csv" required></label>
      <button type="submit">Preview import</button>
    </form>
  </section>`;
}

function renderPreview(rows: CsvImportPreviewRow[] | undefined): string {
  if (rows === undefined) {
    return "";
  }

  return `<section class="panel" aria-labelledby="csv-import-preview-heading">
    <h2 id="csv-import-preview-heading">Import preview</h2>
    ${
      rows.length === 0
        ? '<p class="empty-state">No CSV rows found.</p>'
        : `<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Description</th><th>Payee</th><th>Category</th><th>Amount</th><th>Duplicate</th></tr></thead>
          <tbody>${rows.map(renderPreviewRow).join("")}</tbody>
        </table></div>${renderConfirmForm(rows)}`
    }
  </section>`;
}

function renderConfirmForm(rows: CsvImportPreviewRow[]): string {
  return `<form method="post" action="/imports/csv/confirm">
    <input type="hidden" name="rowsJson" value="${escapeHtml(JSON.stringify(rows))}">
    <button type="submit">Confirm import</button>
  </form>`;
}

function renderPreviewRow(row: CsvImportPreviewRow): string {
  return `<tr>
    <td>${escapeHtml(row.date)}</td>
    <td>${escapeHtml(row.description)}</td>
    <td>${escapeHtml(row.payee ?? "")}</td>
    <td>${escapeHtml(row.categoryName)}</td>
    <td>${formatAmount(row.amountCents)}</td>
    <td>${row.duplicate ? "duplicate" : "new"}</td>
  </tr>`;
}

function renderOption(value: string, label: string, selectedValue?: string): string {
  return `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function formatAmount(amountCents: number): string {
  return (Math.abs(amountCents) / 100).toFixed(2);
}
