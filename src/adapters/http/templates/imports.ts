import type { Account } from "../../../core/accounts/account.js";
import type { Category } from "../../../core/categories/category.js";
import type { ImportProfile } from "../../../core/imports/import-profile.js";
import { escapeHtml, renderNavigation, renderPage } from "./html.js";

export type CsvImportPreviewRow = {
  accountId: string;
  categoryId: string;
  categoryName: string;
  date: string;
  amountCents: number;
  description: string;
  payee: string | null;
  fixedCost: boolean;
  importHash: string;
  duplicate: boolean;
};

export function renderCsvImportPage(input: {
  accounts: Account[];
  categories: Category[];
  importProfiles: ImportProfile[];
  selectedProfile?: ImportProfile;
  previewRows?: CsvImportPreviewRow[];
  profileSaved?: boolean;
  formError?: string;
}): string {
  return renderPage({
    title: "CSV Import",
    heading: "CSV Import",
    navigation: renderNavigation([
      { href: "/", label: "Dashboard" },
      { href: "/transactions", label: "Transactions" },
      { href: "/categorization-rules", label: "Rules" },
      { href: "/admin/master-data", label: "Master Data" },
    ]),
    body: `${renderCsvImportForm(input)}${renderPreview(input.previewRows)}`,
  });
}

function renderCsvImportForm(input: {
  accounts: Account[];
  categories: Category[];
  importProfiles: ImportProfile[];
  selectedProfile?: ImportProfile;
  profileSaved?: boolean;
  formError?: string;
}): string {
  const profile = input.selectedProfile;

  return `<section class="panel" aria-labelledby="csv-import-form-heading">
    <h2 id="csv-import-form-heading">Upload CSV</h2>
    ${input.profileSaved === true ? '<p class="success-message">Import profile saved.</p>' : ""}
    ${input.formError === undefined ? "" : `<p class="form-error">${escapeHtml(input.formError)}</p>`}
    <form class="grid-form" method="get" action="/imports/csv">
      <label class="field">Import profile
        <select name="profileId">${renderProfileOptions(input.importProfiles, profile?.id)}</select>
      </label>
      <button type="submit">Load import profile</button>
    </form>
    <form id="csv-import-form" class="grid-form" method="post" action="/imports/csv/preview" enctype="multipart/form-data">
      <label class="field">Profile name <input name="profileName" value="${escapeHtml(profile?.name ?? "")}"></label>
      <label class="field">Import account
        <select name="accountId">${input.accounts.map((account) => renderOption(account.id, account.name)).join("")}</select>
      </label>
      <label class="field">CSV encoding
        <select name="encoding">
          ${renderOption("utf8", "UTF-8", profile?.encoding)}
          ${renderOption("latin1", "Latin1", profile?.encoding)}
        </select>
      </label>
      <label class="field">Date column <input name="dateColumn" value="${escapeHtml(profile?.dateColumn ?? "Date")}" required></label>
      <label class="field">Amount column <input name="amountColumn" value="${escapeHtml(profile?.amountColumn ?? "Amount")}" required></label>
      <label class="field">Description column <input name="descriptionColumn" value="${escapeHtml(profile?.descriptionColumn ?? "Description")}" required></label>
      <label class="field">Payee column <input name="payeeColumn" value="${escapeHtml(profile?.payeeColumn ?? "Payee")}"></label>
      <label class="field">Category column <input name="categoryColumn" value="${escapeHtml(profile?.categoryColumn ?? "")}"></label>
      <label class="field">CSV file <input name="csvFile" type="file" accept=".csv,text/csv" required></label>
      <button type="submit">Preview import</button>
      <button type="submit" formmethod="post" formaction="/imports/csv/profiles" formenctype="application/x-www-form-urlencoded" formnovalidate>Save import profile</button>
    </form>
  </section>`;
}

function renderProfileOptions(
  profiles: ImportProfile[],
  selectedProfileId: string | undefined,
): string {
  return `<option value="">Manual mapping</option>${profiles.map((profile) => renderOption(profile.id, profile.name, selectedProfileId)).join("")}`;
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
          <thead><tr><th>Date</th><th>Description</th><th>Payee</th><th>Category</th><th>Amount</th><th>Fixed cost</th><th>Duplicate</th></tr></thead>
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
    <td>${row.fixedCost ? "fixed" : "variable"}</td>
    <td>${row.duplicate ? "duplicate" : "new"}</td>
  </tr>`;
}

function renderOption(value: string, label: string, selectedValue?: string): string {
  return `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function formatAmount(amountCents: number): string {
  return (Math.abs(amountCents) / 100).toFixed(2);
}
