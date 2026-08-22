export type TransactionStatus = "booked" | "planned";
export type TransactionSource = "manual" | "csv";
export type CategoryOrigin = "manual" | "csv_mapped" | "rule" | "fallback" | "legacy_preserved";

export type TransactionErrorCode =
  | "required_id"
  | "required_account"
  | "required_category"
  | "invalid_category_origin"
  | "invalid_date"
  | "invalid_amount"
  | "non_expense_amount"
  | "required_description"
  | "invalid_source"
  | "invalid_status"
  | "unsafe_expense_total";

export class TransactionValidationError extends Error {
  constructor(
    readonly code: TransactionErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "TransactionValidationError";
  }
}

export type Transaction = {
  id: string;
  accountId: string;
  categoryId: string;
  categoryOrigin: CategoryOrigin;
  date: string;
  amountCents: number;
  description: string;
  payee: string | null;
  purpose: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  fixedCost: boolean;
  internalTransfer: boolean;
  note: string | null;
  importHash: string | null;
};

export type TransactionInput = Omit<Transaction, "importHash" | "internalTransfer" | "purpose"> & {
  importHash?: string | null;
  internalTransfer?: boolean;
  purpose?: string | null;
};

export type ManualExpenseInput = {
  id: string;
  accountId: string;
  categoryId: string;
  date: string;
  amountCents: number;
  description: string;
  payee?: string | null;
  status?: TransactionStatus;
  fixedCost?: boolean;
  note?: string | null;
};

export function createManualExpense(input: ManualExpenseInput): Transaction {
  return createTransaction({
    id: input.id,
    accountId: input.accountId,
    categoryId: input.categoryId,
    categoryOrigin: "manual",
    date: input.date,
    amountCents: input.amountCents,
    description: input.description,
    payee: input.payee ?? null,
    source: "manual",
    status: input.status ?? "booked",
    fixedCost: input.fixedCost ?? false,
    note: input.note ?? null,
  });
}

export function categoryOriginAfterEdit(
  existingCategoryId: string,
  existingOrigin: CategoryOrigin,
  editedCategoryId: string,
): CategoryOrigin {
  return editedCategoryId === existingCategoryId ? existingOrigin : "manual";
}

export function createTransaction(input: TransactionInput): Transaction {
  const id = input.id.trim();
  const accountId = input.accountId.trim();
  const categoryId = input.categoryId.trim();
  const description = input.description.trim();
  const payee = normalizeOptionalText(input.payee);
  const purpose = normalizeOptionalText(input.purpose);
  const note = normalizeOptionalText(input.note);
  const importHash = normalizeOptionalText(input.importHash ?? null);

  if (id === "") {
    throw new TransactionValidationError("required_id");
  }
  if (accountId === "") {
    throw new TransactionValidationError("required_account");
  }
  if (categoryId === "") {
    throw new TransactionValidationError("required_category");
  }
  if (!isCategoryOrigin(input.categoryOrigin)) {
    throw new TransactionValidationError("invalid_category_origin");
  }
  if (!isGregorianDate(input.date)) {
    throw new TransactionValidationError("invalid_date");
  }
  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents < -2147483648 ||
    input.amountCents > 2147483647
  ) {
    throw new TransactionValidationError("invalid_amount");
  }
  if (input.amountCents >= 0) {
    throw new TransactionValidationError("non_expense_amount");
  }
  if (description === "") {
    throw new TransactionValidationError("required_description");
  }
  if (input.source !== "manual" && input.source !== "csv") {
    throw new TransactionValidationError("invalid_source");
  }
  if (input.status !== "booked" && input.status !== "planned") {
    throw new TransactionValidationError("invalid_status");
  }

  return {
    id,
    accountId,
    categoryId,
    categoryOrigin: input.categoryOrigin,
    date: input.date,
    amountCents: input.amountCents,
    description,
    payee,
    purpose,
    source: input.source,
    status: input.status,
    fixedCost: input.fixedCost,
    internalTransfer: input.internalTransfer ?? false,
    note,
    importHash,
  };
}

export function expenseTotalCents(transactions: Transaction[]): number {
  return transactions.reduce((total, transaction) => {
    const next = transaction.internalTransfer ? total : total + transaction.amountCents;
    if (!Number.isSafeInteger(next)) {
      throw new TransactionValidationError(
        "unsafe_expense_total",
        "Expense total must be a safe integer",
      );
    }
    return next;
  }, 0);
}

function isGregorianDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= (daysInMonth[month - 1] ?? 0);
}

function isCategoryOrigin(value: unknown): value is CategoryOrigin {
  return (
    value === "manual" ||
    value === "csv_mapped" ||
    value === "rule" ||
    value === "fallback" ||
    value === "legacy_preserved"
  );
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
