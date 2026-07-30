import { createHash } from "node:crypto";

export type CsvTransactionRowInput = {
  accountId: string;
  date: string;
  amount: string;
  description: string;
  payee?: string | null;
};

export type NormalizedCsvTransactionRow = {
  accountId: string;
  date: string;
  amountCents: number;
  description: string;
  payee: string | null;
};

export type ImportDuplicateKey = Pick<
  NormalizedCsvTransactionRow,
  "accountId" | "date" | "amountCents" | "description" | "payee"
>;

export type CsvTransactionImportRow = NormalizedCsvTransactionRow & {
  importHash: string;
  duplicate: boolean;
};

export function normalizeCsvTransactionRow(
  input: CsvTransactionRowInput,
): NormalizedCsvTransactionRow {
  const accountId = input.accountId.trim();
  const description = normalizeRequiredText(input.description, "CSV description is required");

  if (accountId === "") {
    throw new Error("CSV account is required");
  }

  return {
    accountId,
    date: normalizeCsvDate(input.date),
    amountCents: parseCsvAmountCents(input.amount),
    description,
    payee: normalizeOptionalText(input.payee),
  };
}

export function createImportHash(input: ImportDuplicateKey): string {
  const key = [
    input.accountId.trim(),
    input.date,
    input.amountCents.toString(),
    normalizeImportText(input.description),
    normalizeImportText(input.payee ?? ""),
  ].join("|");

  return createHash("sha256").update(key).digest("hex");
}

export function detectDuplicateImportRows(
  rows: NormalizedCsvTransactionRow[],
  existingImportHashes: ReadonlySet<string>,
): CsvTransactionImportRow[] {
  const seenImportHashes = new Set<string>();

  return rows.map((row) => {
    const importHash = createImportHash(row);
    const duplicate = existingImportHashes.has(importHash) || seenImportHashes.has(importHash);
    seenImportHashes.add(importHash);

    return {
      ...row,
      importHash,
      duplicate,
    };
  });
}

function normalizeCsvDate(value: string): string {
  const trimmed = value.trim();
  const germanDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  const shortGermanDate = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(trimmed);

  if (germanDate !== null) {
    const [, day, month, year] = germanDate;
    return `${year}-${month}-${day}`;
  }

  if (shortGermanDate !== null) {
    const [, day, month, year] = shortGermanDate;
    return `20${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error("CSV date must use DD.MM.YY, DD.MM.YYYY, or YYYY-MM-DD");
}

function parseCsvAmountCents(value: string): number {
  const compact = value.trim().replaceAll(" ", "");
  const normalized = compact.includes(",")
    ? compact.replaceAll(".", "").replace(",", ".")
    : compact;

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("CSV amount must be a decimal value");
  }

  const amountCents = Math.round(Number(normalized) * 100);

  if (amountCents === 0) {
    throw new Error("CSV amount must not be zero");
  }

  return amountCents;
}

function normalizeRequiredText(value: string, message: string): string {
  const normalized = normalizeDisplayText(value);

  if (normalized === "") {
    throw new Error(message);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeDisplayText(value);
  return normalized === "" ? null : normalized;
}

function normalizeDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeImportText(value: string): string {
  return normalizeDisplayText(value).toLocaleLowerCase("de-DE");
}
