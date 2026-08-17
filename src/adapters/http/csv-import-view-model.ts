import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { ImportProfile } from "../../core/imports/import-profile.js";
import type { Localization } from "../../ports/localization/localization.js";

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

function csvText(localization: Localization) {
  const text = (key: string) => localization.text(key);
  return {
    uploadHeading: text("csv.upload"),
    profileSaved: text("csv.profileSaved"),
    importProfile: text("csv.profile"),
    loadProfile: text("csv.loadProfile"),
    profileName: text("csv.profileName"),
    importAccount: text("csv.account"),
    delimiter: text("csv.delimiter"),
    encoding: text("csv.encoding"),
    dateFormat: text("csv.dateFormat"),
    decimalFormat: text("csv.decimalFormat"),
    dateColumn: text("csv.dateColumn"),
    amountColumn: text("csv.amountColumn"),
    descriptionColumn: text("csv.descriptionColumn"),
    payeeColumn: text("csv.payeeColumn"),
    purposeColumn: text("csv.purposeColumn"),
    categoryColumn: text("csv.categoryColumn"),
    csvFile: text("csv.file"),
    previewImport: text("csv.preview"),
    saveProfile: text("csv.saveProfile"),
    previewHeading: text("csv.previewHeading"),
    noRows: text("csv.noRows"),
    line: text("csv.line"),
    outcome: text("csv.outcome"),
    reason: text("csv.reason"),
    date: text("common.date"),
    description: text("common.description"),
    purpose: text("transaction.purpose"),
    payee: text("transaction.payee"),
    category: text("common.category"),
    amount: text("common.amount"),
    fixedCost: text("transaction.fixedCosts"),
    confirmImport: text("csv.confirm"),
  };
}

export function prepareCsvImportViewModel(input: CsvImportViewInput, localization: Localization) {
  const profile = input.selectedProfile;
  return {
    title: localization.text("csv.title"),
    heading: localization.text("csv.title"),
    text: csvText(localization),
    profileSaved: input.profileSaved === true,
    formError: input.formError,
    ...(profile === undefined ? {} : { profileId: profile.id }),
    selectedProfileUrl:
      profile === undefined
        ? undefined
        : `/imports/csv?profileId=${encodeURIComponent(profile.id)}`,
    profiles: [
      { value: "", label: localization.text("csv.manual"), selected: profile === undefined },
      ...input.importProfiles.map(({ id, name }) => ({
        value: id,
        label: name,
        selected: id === profile?.id,
      })),
    ],
    accounts: input.accounts.map(({ id, name }) => ({ value: id, label: name })),
    delimiters: [
      {
        value: ";",
        label: localization.text("csv.semicolon"),
        selected: (profile?.delimiter ?? ";") === ";",
      },
      { value: ",", label: localization.text("csv.comma"), selected: profile?.delimiter === "," },
      { value: "\t", label: localization.text("csv.tab"), selected: profile?.delimiter === "\t" },
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
        label: localization.text("csv.decimalComma"),
        selected: (profile?.decimalFormat ?? "comma-decimal") === "comma-decimal",
      },
      {
        value: "dot-decimal",
        label: localization.text("csv.decimalPoint"),
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
      outcome: localization.text(`csv.${row.outcome}`),
      reason:
        row.reason === null
          ? ""
          : row.reason === "already-imported"
            ? localization.text("csv.alreadyImported")
            : row.reason,
      date: row.date === undefined ? "" : localization.formatDate(row.date),
      description: row.description ?? "",
      payee: row.payee ?? "",
      purpose: row.purpose ?? "",
      categoryName: row.categoryName ?? "",
      amount: row.amountCents === undefined ? "" : localization.formatAmount(row.amountCents),
      fixedCostLabel:
        row.fixedCost === undefined
          ? ""
          : localization.text(row.fixedCost ? "common.fixed" : "common.variable"),
      duplicateLabel:
        row.outcome === "duplicate" || ("duplicate" in row && row.duplicate === true)
          ? localization.text("csv.duplicate")
          : localization.text("csv.new"),
    })),
  };
}
