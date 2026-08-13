import type {
  ImportProfileDateFormat,
  ImportProfileDecimalFormat,
  ImportProfileDelimiter,
  ImportProfileEncoding,
} from "../../core/imports/import-profile.js";
import { createImportProfile } from "../../core/imports/import-profile.js";

export type MultipartForm = Record<string, string | Buffer | undefined>;

export function createImportProfileFromForm(form: Record<string, string | undefined>, id: string) {
  return createProfile(
    form,
    id,
    readRequiredFormText(form, "profileName", "Profile name is required"),
  );
}

export function createPreviewImportProfile(form: MultipartForm) {
  return createProfile(form, "preview-profile", "Preview profile");
}

function createProfile(form: MultipartForm, id: string, name: string) {
  return createImportProfile({
    id,
    name,
    kind: "custom",
    delimiter: readDelimiter(form),
    encoding: readEncoding(form),
    dateFormat: readDateFormat(form),
    decimalFormat: readDecimalFormat(form),
    dateColumn: readRequiredText(form, "dateColumn", "Date column is required"),
    amountColumn: readRequiredText(form, "amountColumn", "Amount column is required"),
    descriptionColumn: readRequiredText(
      form,
      "descriptionColumn",
      "Description column is required",
    ),
    payeeColumn: readOptionalText(form, "payeeColumn"),
    purposeColumn: readOptionalText(form, "purposeColumn"),
    categoryColumn: readOptionalText(form, "categoryColumn"),
  });
}

export function readImportBatchId(form: Record<string, string | undefined>): string {
  return readRequiredFormText(form, "batchId", "Import preview batch is required");
}

export function readImportAccountId(form: MultipartForm): string {
  return readRequiredText(form, "accountId", "Import account is required");
}

export function readMultipartForm(body: unknown): MultipartForm {
  if (typeof body !== "object" || body === null) return {};
  return body as MultipartForm;
}

export function readRequiredFile(form: MultipartForm, key: string): Buffer {
  const value = form[key];
  if (!Buffer.isBuffer(value) || value.length === 0) throw new Error("CSV file is required");
  if (value.length > 5 * 1024 * 1024) throw new Error("CSV file exceeds 5 MiB limit");
  return value;
}

function readDelimiter(form: MultipartForm): ImportProfileDelimiter {
  const value = readRequiredText(form, "delimiter", "CSV delimiter is required");
  if (value !== "," && value !== ";" && value !== "\t") throw new Error("CSV delimiter is invalid");
  return value;
}

function readEncoding(form: MultipartForm): ImportProfileEncoding {
  const value = readRequiredText(form, "encoding", "CSV encoding is required");
  if (value !== "utf8" && value !== "latin1") throw new Error("CSV encoding is invalid");
  return value;
}

function readDateFormat(form: MultipartForm): ImportProfileDateFormat {
  const value = readRequiredText(form, "dateFormat", "CSV date format is required");
  if (value !== "DD.MM.YY" && value !== "DD.MM.YYYY" && value !== "YYYY-MM-DD") {
    throw new Error("CSV date format is invalid");
  }
  return value;
}

function readDecimalFormat(form: MultipartForm): ImportProfileDecimalFormat {
  const value = readRequiredText(form, "decimalFormat", "CSV decimal format is required");
  if (value !== "comma-decimal" && value !== "dot-decimal") {
    throw new Error("CSV decimal format is invalid");
  }
  return value;
}

function readRequiredText(form: MultipartForm, key: string, message: string): string {
  const value = form[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error(message);
  return value.trim();
}

function readOptionalText(form: MultipartForm, key: string): string | null {
  const value = form[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readRequiredFormText(
  form: Record<string, string | undefined>,
  key: string,
  message: string,
): string {
  return readRequiredText(form, key, message);
}
