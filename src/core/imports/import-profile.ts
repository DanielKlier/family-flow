export type ImportProfileKind = "custom";
export type ImportProfileEncoding = "utf8" | "latin1";
export type ImportProfileDelimiter = "," | ";" | "\t";
export type ImportProfileDateFormat = "DD.MM.YY" | "DD.MM.YYYY" | "YYYY-MM-DD";
export type ImportProfileDecimalFormat = "comma-decimal" | "dot-decimal";

export type ImportProfile = {
  id: string;
  name: string;
  kind: ImportProfileKind;
  delimiter: ImportProfileDelimiter;
  encoding: ImportProfileEncoding;
  dateFormat: ImportProfileDateFormat;
  decimalFormat: ImportProfileDecimalFormat;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  payeeColumn: string | null;
  purposeColumn: string | null;
  categoryColumn: string | null;
};

export type ImportProfileInput = Omit<
  ImportProfile,
  "payeeColumn" | "purposeColumn" | "categoryColumn" | "dateFormat" | "decimalFormat"
> & {
  payeeColumn?: string | null;
  purposeColumn?: string | null;
  categoryColumn?: string | null;
  dateFormat?: ImportProfileDateFormat;
  decimalFormat?: ImportProfileDecimalFormat;
};

export function createImportProfile(input: ImportProfileInput): ImportProfile {
  const id = requireTrimmed(input.id, "Import profile id is required");
  const name = requireTrimmed(input.name, "Import profile name is required");
  const delimiter = requireTrimmed(input.delimiter, "Import profile delimiter is required");
  if (delimiter !== "," && delimiter !== ";" && delimiter !== "\t") {
    throw new Error("Import profile delimiter is invalid");
  }
  const dateColumn = requireTrimmed(input.dateColumn, "Import profile date column is required");
  const amountColumn = requireTrimmed(
    input.amountColumn,
    "Import profile amount column is required",
  );
  const descriptionColumn = requireTrimmed(
    input.descriptionColumn,
    "Import profile description column is required",
  );
  const payeeColumn = normalizeOptionalText(input.payeeColumn ?? null);
  const purposeColumn = normalizeOptionalText(input.purposeColumn ?? null);
  const categoryColumn = normalizeOptionalText(input.categoryColumn ?? null);
  const dateFormat = input.dateFormat ?? "DD.MM.YYYY";
  const decimalFormat = input.decimalFormat ?? "comma-decimal";

  if (input.kind !== "custom") {
    throw new Error("Import profile kind is invalid");
  }

  if (input.encoding !== "utf8" && input.encoding !== "latin1") {
    throw new Error("Import profile encoding is invalid");
  }
  if (dateFormat !== "DD.MM.YY" && dateFormat !== "DD.MM.YYYY" && dateFormat !== "YYYY-MM-DD") {
    throw new Error("Import profile date format is invalid");
  }
  if (decimalFormat !== "comma-decimal" && decimalFormat !== "dot-decimal") {
    throw new Error("Import profile decimal format is invalid");
  }

  return {
    id,
    name,
    kind: input.kind,
    delimiter,
    encoding: input.encoding,
    dateFormat,
    decimalFormat,
    dateColumn,
    amountColumn,
    descriptionColumn,
    payeeColumn,
    purposeColumn,
    categoryColumn,
  };
}

function requireTrimmed(value: string, message: string): string {
  const trimmed = value.trim();

  if (trimmed === "") {
    throw new Error(message);
  }

  return trimmed;
}

function normalizeOptionalText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
