import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { ImportProfile } from "../../core/imports/import-profile.js";

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

export type CsvImportViewInput = {
  accounts: Account[];
  categories: Category[];
  importProfiles: ImportProfile[];
  selectedProfile?: ImportProfile;
  previewRows?: CsvImportPreviewRow[];
  profileSaved?: boolean;
  formError?: string;
};

const csvImportText = {
  uploadHeading: "Upload CSV",
  profileSaved: "Import profile saved.",
  importProfile: "Import profile",
  loadProfile: "Load import profile",
  profileName: "Profile name",
  importAccount: "Import account",
  encoding: "CSV encoding",
  dateColumn: "Date column",
  amountColumn: "Amount column",
  descriptionColumn: "Description column",
  payeeColumn: "Payee column",
  categoryColumn: "Category column",
  csvFile: "CSV file",
  previewImport: "Preview import",
  saveProfile: "Save import profile",
  previewHeading: "Import preview",
  noRows: "No CSV rows found.",
  date: "Date",
  description: "Description",
  payee: "Payee",
  category: "Category",
  amount: "Amount",
  fixedCost: "Fixed cost",
  duplicate: "Duplicate",
  confirmImport: "Confirm import",
} as const;

export function prepareCsvImportViewModel(input: CsvImportViewInput) {
  const profile = input.selectedProfile;
  return {
    title: "CSV Import",
    heading: "CSV Import",
    text: csvImportText,
    profileSaved: input.profileSaved === true,
    formError: input.formError,
    selectedProfileUrl:
      profile === undefined
        ? undefined
        : `/imports/csv?profileId=${encodeURIComponent(profile.id)}`,
    profiles: [
      { value: "", label: "Manual mapping", selected: profile === undefined },
      ...input.importProfiles.map(({ id, name }) => ({
        value: id,
        label: name,
        selected: id === profile?.id,
      })),
    ],
    accounts: input.accounts.map(({ id, name }) => ({ value: id, label: name })),
    encodings: [
      { value: "utf8", label: "UTF-8", selected: profile?.encoding !== "latin1" },
      { value: "latin1", label: "Latin1", selected: profile?.encoding === "latin1" },
    ],
    profileName: profile?.name ?? "",
    dateColumn: profile?.dateColumn ?? "Date",
    amountColumn: profile?.amountColumn ?? "Amount",
    descriptionColumn: profile?.descriptionColumn ?? "Description",
    payeeColumn: profile?.payeeColumn ?? "Payee",
    categoryColumn: profile?.categoryColumn ?? "",
    previewVisible: input.previewRows !== undefined,
    previewEmpty: input.previewRows?.length === 0,
    rowsJson: input.previewRows === undefined ? "" : JSON.stringify(input.previewRows),
    previewRows: input.previewRows?.map((row) => ({
      date: row.date,
      description: row.description,
      payee: row.payee ?? "",
      categoryName: row.categoryName,
      amount: (Math.abs(row.amountCents) / 100).toFixed(2),
      fixedCostLabel: row.fixedCost ? "fixed" : "variable",
      duplicateLabel: row.duplicate ? "duplicate" : "new",
    })),
  };
}
