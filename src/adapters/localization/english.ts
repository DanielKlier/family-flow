import type {
  Localization,
  LocalizationValues,
  MasterDataSeedType,
} from "../../ports/localization/localization.js";
import { messages } from "./english-catalog.js";

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

const legacyErrors: Record<string, string> = {
  "Account name is required": "Account name is required.",
  "Category name is required": "Category name is required.",
  "Owner context label is required": "Owner name is required.",
  "Income name is required": "Description is required.",
  "Income end month must not be before start month":
    "The end month must not precede the start month.",
  "Categorization rule priority must be a non-negative integer":
    "The priority must be a non-negative integer.",
  "CSV file is required": "A CSV file is required.",
  "CSV file exceeds 5 MiB limit": "The CSV file exceeds the 5 MiB limit.",
  "Import profile does not exist": "The import profile does not exist.",
};

export function createEnglishLocalization(): Localization {
  return {
    locale: "en",
    text(key, values) {
      return interpolate(messages[key] ?? key, values);
    },
    formatAmount(cents) {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      }).format(Math.abs(cents) / 100);
    },
    formatDate(value) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      return match === null ? value : `${match[2]}/${match[3]}/${match[1]}`;
    },
    formatMonth(value) {
      const match = /^(\d{4})-(\d{2})$/.exec(value);
      return match === null ? value : `${match[2]}/${match[1]}`;
    },
    parseAmountCents(value, allowZero) {
      return parseAmount(value, allowZero);
    },
    parseExpenseCents(value) {
      return -parseAmount(value, false);
    },
    parseDate,
    parseMonth(value) {
      const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value);
      if (match === null) throw new LocalizedFormError("invalid_date");
      return `${match[2]}-${match[1]}`;
    },
    errorMessage(error, fallbackKey) {
      if (
        error instanceof LocalizedFormError ||
        hasCode(error, "invalid_date") ||
        hasCode(error, "invalid_amount") ||
        hasCode(error, "non_expense_amount") ||
        hasCode(error, "required_description")
      )
        return messages[fallbackKey] ?? fallbackKey;
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
      return value.toLocaleLowerCase("en-US");
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
  const match = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/.exec(value);
  if (match === null) throw new LocalizedFormError("invalid_amount");
  const integer = value.split(".", 1)[0]?.replaceAll(",", "") ?? "";
  const cents = Number(integer) * 100 + Number((match[1] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || (!allowZero && cents <= 0))
    throw new LocalizedFormError("invalid_amount");
  return cents;
}
function parseDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (match === null) throw new LocalizedFormError("invalid_date");
  const [, month, day, year] = match;
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
