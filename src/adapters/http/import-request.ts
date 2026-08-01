import { createImportProfile } from "../../core/imports/import-profile.js";
import type { CsvTransactionImportRow } from "../../core/imports/csv-import.js";
import type { ImportProfileEncoding } from "../../core/imports/import-profile.js";

export type MultipartForm = Record<string, string | Buffer | undefined>;

export type PreviewRowPayload = CsvTransactionImportRow & {
  categoryId: string;
  fixedCost: boolean;
};

export function createImportProfileFromForm(form: Record<string, string | undefined>, id: string) {
  return createImportProfile({
    id,
    name: readRequiredFormText(form, "profileName", "Profile name is required"),
    kind: "custom",
    delimiter: ";",
    encoding: readFormEncoding(form),
    dateColumn: readRequiredFormText(form, "dateColumn", "Date column is required"),
    amountColumn: readRequiredFormText(form, "amountColumn", "Amount column is required"),
    descriptionColumn: readRequiredFormText(
      form,
      "descriptionColumn",
      "Description column is required",
    ),
    payeeColumn: readOptionalFormText(form, "payeeColumn"),
    categoryColumn: readOptionalFormText(form, "categoryColumn"),
  });
}

export function createPreviewImportProfile(form: MultipartForm) {
  return createImportProfile({
    id: "preview-profile",
    name: "Preview profile",
    kind: "custom",
    delimiter: ";",
    encoding: readEncoding(form),
    dateColumn: readRequiredText(form, "dateColumn", "Date column is required"),
    amountColumn: readRequiredText(form, "amountColumn", "Amount column is required"),
    descriptionColumn: readRequiredText(
      form,
      "descriptionColumn",
      "Description column is required",
    ),
    payeeColumn: readOptionalText(form, "payeeColumn"),
    categoryColumn: readOptionalText(form, "categoryColumn"),
  });
}

export function parsePreviewRows(value: string | undefined): PreviewRowPayload[] {
  if (value === undefined || value.trim() === "") {
    throw new Error("Import preview rows are required");
  }

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Import preview rows are invalid");
  }

  return parsed.map(readPreviewRowPayload);
}

export function readImportAccountId(form: MultipartForm): string {
  return readRequiredText(form, "accountId", "Import account is required");
}

export function readMultipartForm(body: unknown): MultipartForm {
  if (typeof body !== "object" || body === null) {
    return {};
  }

  return body as MultipartForm;
}

export function readRequiredFile(form: MultipartForm, key: string): Buffer {
  const value = form[key];
  if (!Buffer.isBuffer(value) || value.length === 0) {
    throw new Error("CSV file is required");
  }

  return value;
}

function readPreviewRowPayload(value: unknown): PreviewRowPayload {
  if (typeof value !== "object" || value === null) {
    throw new Error("Import preview row is invalid");
  }

  const row = value as Record<string, unknown>;
  return {
    accountId: readString(row, "accountId"),
    categoryId: readString(row, "categoryId"),
    date: readString(row, "date"),
    amountCents: readNumber(row, "amountCents"),
    description: readString(row, "description"),
    payee: readNullableString(row, "payee"),
    fixedCost: readBoolean(row, "fixedCost"),
    importHash: readString(row, "importHash"),
    duplicate: readBoolean(row, "duplicate"),
  };
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Import preview row is invalid");
  }

  return value;
}

function readNullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Import preview row is invalid");
  }

  return value;
}

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Import preview row is invalid");
  }

  return value;
}

function readBoolean(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") {
    throw new Error("Import preview row is invalid");
  }

  return value;
}

function readRequiredText(form: MultipartForm, key: string, message: string): string {
  const value = form[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }

  return value.trim();
}

function readOptionalText(form: MultipartForm, key: string): string | null {
  const value = form[key];
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function readEncoding(form: MultipartForm): ImportProfileEncoding {
  const encoding = readRequiredText(form, "encoding", "CSV encoding is required");
  if (encoding !== "utf8" && encoding !== "latin1") {
    throw new Error("CSV encoding is invalid");
  }

  return encoding;
}

function readFormEncoding(form: Record<string, string | undefined>): ImportProfileEncoding {
  const encoding = readRequiredFormText(form, "encoding", "CSV encoding is required");
  if (encoding !== "utf8" && encoding !== "latin1") {
    throw new Error("CSV encoding is invalid");
  }

  return encoding;
}

function readRequiredFormText(
  form: Record<string, string | undefined>,
  key: string,
  message: string,
): string {
  const value = form[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(message);
  }

  return value.trim();
}

function readOptionalFormText(
  form: Record<string, string | undefined>,
  key: string,
): string | null {
  const value = form[key];
  if (value === undefined || value.trim() === "") {
    return null;
  }

  return value.trim();
}
