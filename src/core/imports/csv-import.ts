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

export type PersistedImportIdentity = {
  importHash: string | null;
  purpose: string | null;
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
  return createFramedImportHash("v3", [
    ...historicalImportIdentityFields(input),
    purposeField(input),
  ]);
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
  return new Set([
    createImportHash(input),
    createFramedImportHash("v2", historicalImportIdentityFields(input)),
    createLegacyImportHash(input),
  ]);
}

export function detectDuplicateImportRows(
  rows: NormalizedCsvTransactionRow[],
  existingIdentities: readonly PersistedImportIdentity[],
): CsvTransactionImportRow[] {
  const seenImportHashes = new Set<string>();

  return rows.map((row) => {
    const importHash = createImportHash(row);
    const candidates = createImportHashCandidates(row);
    const duplicate =
      existingIdentities.some((identity) => matchesPersistedIdentity(row, candidates, identity)) ||
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return requireGregorianDate(trimmed);
  throw new Error("CSV date must use the canonical YYYY-MM-DD format");
}

function parseCsvAmountCents(value: string): number {
  const compact = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(compact);
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

function createFramedImportHash(version: "v2" | "v3", fields: string[]): string {
  const framedKey = fields.map((field) => `${Buffer.byteLength(field, "utf8")}:${field}`).join("");
  return `${version}:${createHash("sha256").update(framedKey).digest("hex")}`;
}

function historicalImportIdentityFields(input: ImportDuplicateKey): string[] {
  return [
    input.accountId.trim().normalize("NFKC"),
    input.date.normalize("NFKC"),
    input.amountCents.toString(),
    normalizeImportText(input.description),
    normalizeImportText(input.payee ?? ""),
  ];
}

function purposeField(input: ImportDuplicateKey): string {
  return normalizeImportText(input.purpose ?? "");
}

function matchesPersistedIdentity(
  row: ImportDuplicateKey,
  candidates: ReadonlySet<string>,
  identity: PersistedImportIdentity,
): boolean {
  if (identity.importHash === null || !candidates.has(identity.importHash)) return false;
  if (identity.importHash.startsWith("v3:")) return true;
  return normalizeImportText(identity.purpose ?? "") === purposeField(row);
}

function normalizeImportText(value: string): string {
  return normalizeDisplayText(value).normalize("NFKC").toLowerCase();
}

function normalizeLegacyImportText(value: string): string {
  return normalizeDisplayText(value).toLowerCase();
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
