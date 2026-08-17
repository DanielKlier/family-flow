export type TransactionStatus = "booked" | "planned";
export type TransactionSource = "manual" | "csv";

export type TransactionErrorCode =
  | "required_id"
  | "required_account"
  | "required_category"
  | "invalid_date"
  | "invalid_amount"
  | "non_expense_amount"
  | "required_description"
  | "invalid_source"
  | "invalid_status";

export class TransactionValidationError extends Error {
  constructor(readonly code: TransactionErrorCode) {
    super(code);
    this.name = "TransactionValidationError";
  }
}

export type Transaction = {
  id: string;
  accountId: string;
  categoryId: string;
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new TransactionValidationError("invalid_date");
  }
  if (!Number.isSafeInteger(input.amountCents)) {
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
  return transactions.reduce(
    (total, transaction) =>
      transaction.internalTransfer ? total : total + transaction.amountCents,
    0,
  );
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
