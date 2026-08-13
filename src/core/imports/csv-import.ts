import { createHash } from "node:crypto";

export type CsvTransactionRowInput = {
  accountId: string;
  date: string;
  amount: string;
  description: string;
  payee?: string | null;
  purpose?: string | null;
};

export type NormalizedCsvTransactionRow = {
  accountId: string;
  date: string;
  amountCents: number;
  description: string;
  payee: string | null;
  purpose: string | null;
};

export type ImportDuplicateKey = Pick<
  NormalizedCsvTransactionRow,
  "accountId" | "date" | "amountCents" | "description" | "payee" | "purpose"
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
    purpose: normalizeOptionalText(input.purpose),
  };
}

export function createImportHash(input: ImportDuplicateKey): string {
  const framedKey = importIdentityFields(input)
    .map((field) => `${Buffer.byteLength(field, "utf8")}:${field}`)
    .join("");

  return `v2:${createHash("sha256").update(framedKey).digest("hex")}`;
}

export function createLegacyImportHash(input: ImportDuplicateKey): string {
  const legacyKey = [
    input.accountId.trim(),
    input.date,
    input.amountCents.toString(),
    normalizeLegacyImportText(input.description),
    normalizeLegacyImportText(input.payee ?? ""),
  ].join("|");
  return createHash("sha256").update(legacyKey).digest("hex");
}

export function createImportHashCandidates(input: ImportDuplicateKey): ReadonlySet<string> {
  return new Set([createImportHash(input), createLegacyImportHash(input)]);
}

export function detectDuplicateImportRows(
  rows: NormalizedCsvTransactionRow[],
  existingImportHashes: ReadonlySet<string>,
): CsvTransactionImportRow[] {
  const seenImportHashes = new Set<string>();

  return rows.map((row) => {
    const importHash = createImportHash(row);
    const candidates = createImportHashCandidates(row);
    const duplicate =
      [...candidates].some((candidate) => existingImportHashes.has(candidate)) ||
      seenImportHashes.has(importHash);
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
    return requireGregorianDate(`${year}-${month}-${day}`);
  }

  if (shortGermanDate !== null) {
    const [, day, month, year] = shortGermanDate;
    return requireGregorianDate(`20${year}-${month}-${day}`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return requireGregorianDate(trimmed);
  }

  throw new Error("CSV date must use DD.MM.YY, DD.MM.YYYY, or YYYY-MM-DD");
}

function parseCsvAmountCents(value: string): number {
  const compact = value.trim();
  const normalized = normalizeAmountDecimal(compact);
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (match === null) throw new Error("CSV amount must be a decimal value");

  const [, sign, whole, fraction = ""] = match;
  const magnitude = BigInt(whole ?? "0") * 100n + BigInt(fraction.padEnd(2, "0"));
  const signedCents = sign === "-" ? -magnitude : magnitude;
  if (
    signedCents > BigInt(Number.MAX_SAFE_INTEGER) ||
    signedCents < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error("CSV amount exceeds the safe minor-unit range");
  }
  if (signedCents === 0n) throw new Error("CSV amount must not be zero");

  return Number(signedCents);
}

function normalizeAmountDecimal(compact: string): string {
  if (!compact.includes(",")) return compact;
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(compact)) {
    throw new Error("CSV amount must be a decimal value");
  }
  return compact.replaceAll(".", "").replace(",", ".");
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

function importIdentityFields(input: ImportDuplicateKey): string[] {
  return [
    input.accountId.trim().normalize("NFKC"),
    input.date.normalize("NFKC"),
    input.amountCents.toString(),
    normalizeImportText(input.description),
    normalizeImportText(input.payee ?? ""),
  ];
}

function normalizeImportText(value: string): string {
  return normalizeDisplayText(value).normalize("NFKC").toLocaleLowerCase("de-DE");
}

function normalizeLegacyImportText(value: string): string {
  return normalizeDisplayText(value).toLocaleLowerCase("de-DE");
}

function requireGregorianDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error("CSV date is invalid");
  }

  return value;
}
