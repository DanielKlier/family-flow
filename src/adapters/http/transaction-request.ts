import { parseOwnerContext } from "../../core/shared/owner-context.js";
import {
  categoryOriginAfterEdit,
  createManualExpense,
  createTransaction,
  type Transaction,
} from "../../core/transactions/transaction.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { TransactionFilters } from "../../ports/repositories/transaction-repository.js";
import type { FormBody } from "./request-values.js";
import { readOptionalQueryValue } from "./request-values.js";

export function readTransactionFilters(
  query: unknown,
  localization: Localization,
): TransactionFilters {
  if (typeof query !== "object" || query === null) {
    return {};
  }

  const filters: TransactionFilters = {};
  const month = readOptionalQueryValue(query, "month");
  if (month !== undefined) {
    try {
      filters.month = localization.parseMonth(month);
    } catch (error) {
      if (!localization.isInputError(error)) throw error;
    }
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
  const internalTransfer = readOptionalQueryValue(query, "internalTransfer");
  if (internalTransfer === "marked") {
    filters.internalTransfer = true;
  }
  if (internalTransfer === "unmarked") {
    filters.internalTransfer = false;
  }

  return filters;
}

export function createTransactionFromForm(
  form: FormBody,
  id: string,
  localization: Localization,
  existing?: Transaction,
): Transaction {
  const manual = createManualExpense({
    id,
    accountId: requireFormValue(form, "accountId", localization),
    categoryId: requireFormValue(form, "categoryId", localization),
    date: localization.parseDate(requireFormValue(form, "date", localization)),
    amountCents: localization.parseExpenseCents(requireFormValue(form, "amount", localization)),
    description: requireFormValue(form, "description", localization),
    payee: form.payee ?? null,
    status: form.status === "planned" ? "planned" : "booked",
    fixedCost: form.fixedCost === "on",
    note: form.note ?? null,
  });
  if (existing === undefined) return manual;
  return createTransaction({
    ...manual,
    categoryOrigin: categoryOriginAfterEdit(
      existing.categoryId,
      existing.categoryOrigin,
      manual.categoryId,
    ),
    source: existing.source,
    purpose: form.purpose ?? existing.purpose,
    importHash: existing.importHash,
    internalTransfer: existing.internalTransfer,
  });
}

const requiredFields = {
  accountId: "account",
  categoryId: "category",
  date: "date",
  description: "description",
  amount: "amount",
} as const;

function requireFormValue(
  form: FormBody,
  name: keyof typeof requiredFields,
  localization: Localization,
): string {
  const value = form[name];
  if (value === undefined || value.trim() === "")
    throw localization.requiredField(requiredFields[name]);
  return value;
}
