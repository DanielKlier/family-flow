import type {
  Localization,
  LocalizationValues,
  MasterDataSeedType,
} from "../../ports/localization/localization.js";
import { messages } from "./german-catalog.js";

type FormErrorCode =
  | "required_account"
  | "required_category"
  | "required_date"
  | "required_description"
  | "required_amount"
  | "invalid_amount"
  | "invalid_date";

class LocalizedFormError extends Error {
  constructor(readonly code: FormErrorCode) {
    super(code);
    this.name = "LocalizedFormError";
  }
}

const formErrors: Record<FormErrorCode, string> = {
  required_account: "Konto ist erforderlich.",
  required_category: "Kategorie ist erforderlich.",
  required_date: "Datum ist erforderlich.",
  required_description: "Beschreibung ist erforderlich.",
  required_amount: "Betrag ist erforderlich.",
  invalid_amount: "Der Betrag ist ungültig.",
  invalid_date: "Das Datum ist ungültig.",
};
const legacyErrors: Record<string, string> = {
  "Account name is required": "Kontoname ist erforderlich.",
  "Category name is required": "Kategoriename ist erforderlich.",
  "Owner context label is required": "Eigentümername ist erforderlich.",
  "Income name is required": "Bezeichnung ist erforderlich.",
  "Income end month must not be before start month":
    "Der Endmonat darf nicht vor dem Startmonat liegen.",
  "Categorization rule priority must be a non-negative integer":
    "Die Priorität muss eine nichtnegative ganze Zahl sein.",
  "CSV file is required": "Eine CSV-Datei ist erforderlich.",
  "CSV file exceeds 5 MiB limit": "Die CSV-Datei überschreitet die Grenze von 5 MiB.",
  "Import profile does not exist": "Das Importprofil ist nicht vorhanden.",
};

export function createGermanLocalization(): Localization {
  return {
    locale: "de-DE",
    text(key, values) {
      return interpolate(messages[key] ?? key, values);
    },
    formatAmount(cents) {
      return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      }).format(Math.abs(cents) / 100);
    },
    formatDate(value) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      return match === null ? value : `${match[3]}.${match[2]}.${match[1]}`;
    },
    formatMonth(value) {
      const match = /^(\d{4})-(\d{2})$/.exec(value);
      return match === null ? value : `${match[2]}.${match[1]}`;
    },
    parseAmountCents(value, allowZero) {
      return parseAmount(value, allowZero);
    },
    parseExpenseCents(value) {
      return -parseAmount(value, false);
    },
    parseDate,
    parseMonth(value) {
      const match = /^(0[1-9]|1[0-2])\.(\d{4})$/.exec(value);
      if (match === null) throw new LocalizedFormError("invalid_date");
      return `${match[2]}-${match[1]}`;
    },
    errorMessage(error, fallbackKey) {
      if (error instanceof LocalizedFormError) return formErrors[error.code];
      if (hasCode(error, "invalid_date")) return formErrors.invalid_date;
      if (hasCode(error, "invalid_amount") || hasCode(error, "non_expense_amount"))
        return formErrors.invalid_amount;
      if (hasCode(error, "required_description")) return formErrors.required_description;
      if (hasCode(error, "unknown_account")) return messages["transaction.unknownAccount"];
      if (hasCode(error, "unknown_category")) return messages["transaction.unknownCategory"];
      return error instanceof Error
        ? (legacyErrors[error.message] ?? messages[fallbackKey] ?? fallbackKey)
        : (messages[fallbackKey] ?? fallbackKey);
    },
    isInputError(error) {
      return error instanceof LocalizedFormError;
    },
    requiredField(field) {
      return new LocalizedFormError(`required_${field}`);
    },
    caseFold(value) {
      return value.toLocaleLowerCase("de-DE");
    },
    seedName(type, id) {
      return requiredMessage(seedNameKey(type, id));
    },
  };
}

function seedNameKey(type: MasterDataSeedType, id: string): string {
  return `seed.${type}.${id}`;
}
function requiredMessage(key: string): string {
  const message = messages[key];
  if (message === undefined) throw new Error(`Missing localization message: ${key}`);
  return message;
}
function interpolate(template: string, values?: LocalizationValues): string {
  if (values === undefined) return template;
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}
function parseAmount(value: string, allowZero: boolean): number {
  const match = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(value);
  if (match === null) throw new LocalizedFormError("invalid_amount");
  const integer = value.split(",", 1)[0]?.replaceAll(".", "") ?? "";
  const cents = Number(integer) * 100 + Number((match[1] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || (!allowZero && cents <= 0))
    throw new LocalizedFormError("invalid_amount");
  return cents;
}
function parseDate(value: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (match === null) throw new LocalizedFormError("invalid_date");
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  )
    throw new LocalizedFormError("invalid_date");
  return `${year}-${month}-${day}`;
}
function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && Reflect.get(error, "code") === code;
}
