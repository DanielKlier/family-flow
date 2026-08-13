import { parseOwnerContext } from "../../core/shared/owner-context.js";
import {
  createManualExpense,
  createTransaction,
  type Transaction,
} from "../../core/transactions/transaction.js";
import type { TransactionFilters } from "../../ports/repositories/transaction-repository.js";
import type { FormBody } from "./request-values.js";
import { readOptionalQueryValue } from "./request-values.js";

export function readTransactionFilters(query: unknown): TransactionFilters {
  if (typeof query !== "object" || query === null) {
    return {};
  }

  const filters: TransactionFilters = {};
  const month = readOptionalQueryValue(query, "month");
  if (month !== undefined && /^\d{4}-\d{2}$/.test(month)) {
    filters.month = month;
  }
  const accountId = readOptionalQueryValue(query, "accountId");
  if (accountId !== undefined) {
    filters.accountId = accountId;
  }
  const categoryId = readOptionalQueryValue(query, "categoryId");
  if (categoryId !== undefined) {
    filters.categoryId = categoryId;
  }
  const status = readOptionalQueryValue(query, "status");
  if (status === "booked" || status === "planned") {
    filters.status = status;
  }
  const ownerContext = readOptionalQueryValue(query, "ownerContext");
  if (ownerContext !== undefined) {
    filters.ownerContext = parseOwnerContext(ownerContext);
  }
  const fixedCost = readOptionalQueryValue(query, "fixedCost");
  if (fixedCost === "fixed") {
    filters.fixedCost = true;
  }
  if (fixedCost === "variable") {
    filters.fixedCost = false;
  }

  return filters;
}

export function createTransactionFromForm(
  form: FormBody,
  id: string,
  existing?: Transaction,
): Transaction {
  const manual = createManualExpense({
    id,
    accountId: requireFormValue(form, "accountId"),
    categoryId: requireFormValue(form, "categoryId"),
    date: requireFormValue(form, "date"),
    amount: requireFormValue(form, "amount"),
    description: requireFormValue(form, "description"),
    payee: form.payee ?? null,
    status: form.status === "planned" ? "planned" : "booked",
    fixedCost: form.fixedCost === "on",
    note: form.note ?? null,
  });
  if (existing === undefined) return manual;
  return createTransaction({
    ...manual,
    source: existing.source,
    purpose: form.purpose ?? existing.purpose,
    importHash: existing.importHash,
  });
}

function requireFormValue(form: FormBody, name: string): string {
  const value = form[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}
