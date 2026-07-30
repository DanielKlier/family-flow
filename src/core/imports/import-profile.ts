export type ImportProfileKind = "custom";
export type ImportProfileEncoding = "utf8" | "latin1";

export type ImportProfile = {
  id: string;
  name: string;
  kind: ImportProfileKind;
  delimiter: string;
  encoding: ImportProfileEncoding;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  payeeColumn: string | null;
  categoryColumn: string | null;
};

export type ImportProfileInput = Omit<ImportProfile, "payeeColumn" | "categoryColumn"> & {
  payeeColumn?: string | null;
  categoryColumn?: string | null;
};

export function createImportProfile(input: ImportProfileInput): ImportProfile {
  const id = requireTrimmed(input.id, "Import profile id is required");
  const name = requireTrimmed(input.name, "Import profile name is required");
  const delimiter = requireTrimmed(input.delimiter, "Import profile delimiter is required");
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
  const categoryColumn = normalizeOptionalText(input.categoryColumn ?? null);

  if (input.kind !== "custom") {
    throw new Error("Import profile kind is invalid");
  }

  if (input.encoding !== "utf8" && input.encoding !== "latin1") {
    throw new Error("Import profile encoding is invalid");
  }

  return {
    id,
    name,
    kind: input.kind,
    delimiter,
    encoding: input.encoding,
    dateColumn,
    amountColumn,
    descriptionColumn,
    payeeColumn,
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
