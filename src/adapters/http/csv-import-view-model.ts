import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { ImportProfile } from "../../core/imports/import-profile.js";

export type CsvImportPreviewRow = {
  line: number;
  outcome: "importable" | "duplicate" | "ignored" | "invalid";
  reason: string | null;
  date?: string;
  amountCents?: number;
  description?: string;
  payee?: string | null;
  purpose?: string | null;
  categoryName?: string;
  fixedCost?: boolean;
};

export type CsvImportViewInput = {
  accounts: Account[];
  categories: Category[];
  importProfiles: ImportProfile[];
  selectedProfile?: ImportProfile;
  previewRows?: CsvImportPreviewRow[];
  batchId?: string;
  profileSaved?: boolean;
  formError?: string;
};

const text = {
  uploadHeading: "Upload CSV",
  profileSaved: "Import profile saved.",
  importProfile: "Import profile",
  loadProfile: "Load import profile",
  profileName: "Profile name",
  importAccount: "Import account",
  delimiter: "CSV delimiter",
  encoding: "CSV encoding",
  dateFormat: "CSV date format",
  decimalFormat: "CSV decimal format",
  dateColumn: "Date column",
  amountColumn: "Amount column",
  descriptionColumn: "Description column",
  payeeColumn: "Payee column",
  purposeColumn: "Purpose column",
  categoryColumn: "Category column",
  csvFile: "CSV file",
  previewImport: "Preview import",
  saveProfile: "Save import profile",
  previewHeading: "Import preview",
  noRows: "No CSV rows found.",
  line: "Line",
  outcome: "Outcome",
  reason: "Reason",
  date: "Date",
  description: "Description",
  purpose: "Purpose",
  payee: "Payee",
  category: "Category",
  amount: "Amount",
  fixedCost: "Fixed cost",
  confirmImport: "Confirm import",
} as const;

export function prepareCsvImportViewModel(input: CsvImportViewInput) {
  const profile = input.selectedProfile;
  return {
    title: "CSV Import",
    heading: "CSV Import",
    text,
    profileSaved: input.profileSaved === true,
    formError: input.formError,
    ...(profile === undefined ? {} : { profileId: profile.id }),
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
    delimiters: [
      { value: ";", label: "Semicolon", selected: (profile?.delimiter ?? ";") === ";" },
      { value: ",", label: "Comma", selected: profile?.delimiter === "," },
      { value: "\t", label: "Tab", selected: profile?.delimiter === "\t" },
    ],
    encodings: [
      { value: "utf8", label: "UTF-8", selected: profile?.encoding !== "latin1" },
      { value: "latin1", label: "Latin1", selected: profile?.encoding === "latin1" },
    ],
    dateFormats: ["DD.MM.YY", "DD.MM.YYYY", "YYYY-MM-DD"].map((value) => ({
      value,
      label: value,
      selected: (profile?.dateFormat ?? "DD.MM.YYYY") === value,
    })),
    decimalFormats: [
      {
        value: "comma-decimal",
        label: "Comma decimal",
        selected: (profile?.decimalFormat ?? "comma-decimal") === "comma-decimal",
      },
      {
        value: "dot-decimal",
        label: "Dot decimal",
        selected: profile?.decimalFormat === "dot-decimal",
      },
    ],
    profileName: profile?.name ?? "",
    dateColumn: profile?.dateColumn ?? "Date",
    amountColumn: profile?.amountColumn ?? "Amount",
    descriptionColumn: profile?.descriptionColumn ?? "Description",
    payeeColumn: profile === undefined ? "Payee" : (profile.payeeColumn ?? ""),
    purposeColumn: profile?.purposeColumn ?? "",
    categoryColumn: profile?.categoryColumn ?? "",
    previewVisible: input.previewRows !== undefined,
    previewEmpty: input.previewRows?.length === 0,
    batchId: input.batchId ?? "",
    confirmDisabled: input.previewRows?.some((row) => row.outcome === "invalid") ?? false,
    previewRows: input.previewRows?.map((row) => ({
      line: row.line,
      outcome: row.outcome,
      reason: row.reason ?? "",
      date: row.date ?? "",
      description: row.description ?? "",
      payee: row.payee ?? "",
      purpose: row.purpose ?? "",
      categoryName: row.categoryName ?? "",
      amount: row.amountCents === undefined ? "" : (Math.abs(row.amountCents) / 100).toFixed(2),
      fixedCostLabel: row.fixedCost === undefined ? "" : row.fixedCost ? "fixed" : "variable",
      duplicateLabel:
        row.outcome === "duplicate" || ("duplicate" in row && row.duplicate === true)
          ? "duplicate"
          : "new",
    })),
  };
}
