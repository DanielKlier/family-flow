export type TransactionStatus = "booked" | "planned";
export type TransactionSource = "manual" | "csv";

export type Transaction = {
  id: string;
  accountId: string;
  categoryId: string;
  date: string;
  amountCents: number;
  description: string;
  payee: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  fixedCost: boolean;
  note: string | null;
  importHash: string | null;
};

export type TransactionInput = Omit<Transaction, "importHash"> & {
  importHash?: string | null;
};

export function createTransaction(input: TransactionInput): Transaction {
  const id = input.id.trim();
  const accountId = input.accountId.trim();
  const categoryId = input.categoryId.trim();
  const description = input.description.trim();
  const payee = normalizeOptionalText(input.payee);
  const note = normalizeOptionalText(input.note);
  const importHash = normalizeOptionalText(input.importHash ?? null);

  if (id === "") {
    throw new Error("Transaction id is required");
  }
  if (accountId === "") {
    throw new Error("Transaction account is required");
  }
  if (categoryId === "") {
    throw new Error("Transaction category is required");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Transaction date must use YYYY-MM-DD");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents >= 0) {
    throw new Error("Transaction amount must be a negative expense");
  }
  if (description === "") {
    throw new Error("Transaction description is required");
  }
  if (input.source !== "manual" && input.source !== "csv") {
    throw new Error("Transaction source is invalid");
  }
  if (input.status !== "booked" && input.status !== "planned") {
    throw new Error("Transaction status is invalid");
  }

  return {
    id,
    accountId,
    categoryId,
    date: input.date,
    amountCents: input.amountCents,
    description,
    payee,
    source: input.source,
    status: input.status,
    fixedCost: input.fixedCost,
    note,
    importHash,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
