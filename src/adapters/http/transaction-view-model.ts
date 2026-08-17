import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";
import type { Transaction } from "../../core/transactions/transaction.js";
import type { Localization } from "../../ports/localization/localization.js";
import type { TransactionFilters } from "../../ports/repositories/transaction-repository.js";

type SelectOption = {
  value: string;
  label: string;
  selected: boolean;
};

type TransactionListInput = {
  categories: Category[];
  transactions: Transaction[];
  filters?: TransactionFilters;
};

export function prepareTransactionListViewModel(
  input: TransactionListInput,
  localization: Localization,
) {
  const categoryNames = new Map(input.categories.map((category) => [category.id, category.name]));
  const filterQuery = transactionFiltersQuery(input.filters ?? {}, localization);

  return {
    text: transactionText(localization),
    empty: input.transactions.length === 0,
    rows: input.transactions.map((transaction) => ({
      date: localization.formatDate(transaction.date),
      description: transaction.description,
      category: categoryNames.get(transaction.categoryId) ?? transaction.categoryId,
      amount: localization.formatAmount(transaction.amountCents),
      status: localization.text(`transaction.${transaction.status}`),
      fixedCostLabel: localization.text(transaction.fixedCost ? "common.fixed" : "common.variable"),
      internalTransfer: transaction.internalTransfer,
      internalTransferLabel: transaction.internalTransfer
        ? localization.text("transaction.internalTransfer")
        : "",
      internalTransferUrl: `/transactions/${encodeURIComponent(transaction.id)}/internal-transfer${filterQuery}`,
      internalTransferValue: transaction.internalTransfer ? "false" : "true",
      internalTransferAction: localization.text(
        transaction.internalTransfer ? "transaction.unmarkTransfer" : "transaction.markTransfer",
      ),
      editUrl: `/transactions/${encodeURIComponent(transaction.id)}/edit`,
      deleteUrl: `/transactions/${encodeURIComponent(transaction.id)}/delete`,
    })),
  };
}

export function transactionFiltersQuery(
  filters: TransactionFilters,
  localization: Localization,
): string {
  const query = new URLSearchParams();
  if (filters.month !== undefined) query.set("month", localization.formatMonth(filters.month));
  if (filters.accountId !== undefined) query.set("accountId", filters.accountId);
  if (filters.ownerContext !== undefined) query.set("ownerContext", filters.ownerContext);
  if (filters.categoryId !== undefined) query.set("categoryId", filters.categoryId);
  if (filters.status !== undefined) query.set("status", filters.status);
  if (filters.fixedCost !== undefined)
    query.set("fixedCost", filters.fixedCost ? "fixed" : "variable");
  if (filters.internalTransfer !== undefined) {
    query.set("internalTransfer", filters.internalTransfer ? "marked" : "unmarked");
  }
  const serialized = query.toString();
  return serialized === "" ? "" : `?${serialized}`;
}

function transactionText(localization: Localization) {
  const text = (key: string) => localization.text(key);
  return {
    account: text("common.account"),
    category: text("common.category"),
    date: text("common.date"),
    datePlaceholder: text("transaction.datePlaceholder"),
    description: text("common.description"),
    payee: text("transaction.payee"),
    purpose: text("transaction.purpose"),
    amount: text("common.amount"),
    amountPlaceholder: text("transaction.amountPlaceholder"),
    status: text("common.status"),
    fixedCost: text("transaction.fixedCosts"),
    note: text("common.note"),
    filtersHeading: text("transaction.filters"),
    month: text("common.month"),
    monthPlaceholder: text("transaction.monthPlaceholder"),
    filterAccount: text("transaction.filterAccount"),
    ownerContext: text("transaction.filterOwner"),
    filterCategory: text("transaction.filterCategory"),
    filterStatus: text("transaction.filterStatus"),
    fixedCostFilter: text("transaction.costType"),
    internalTransferFilter: text("transaction.transferStatus"),
    applyFilters: text("transaction.applyFilters"),
    listHeading: text("transaction.list"),
    empty: text("transaction.empty"),
    actions: text("common.actions"),
    edit: text("common.edit"),
    delete: text("common.delete"),
  };
}

export function prepareTransactionFormViewModel(
  input: {
    accounts: Account[];
    categories: Category[];
    transaction?: Transaction;
    formError?: string;
  },
  localization: Localization,
) {
  const transaction = input.transaction;

  return {
    text: transactionText(localization),
    heading: localization.text(transaction === undefined ? "transaction.add" : "transaction.edit"),
    actionUrl:
      transaction === undefined
        ? "/transactions"
        : `/transactions/${encodeURIComponent(transaction.id)}`,
    submitLabel: localization.text(
      transaction === undefined ? "transaction.add" : "transaction.save",
    ),
    create: transaction === undefined,
    formError: input.formError,
    accounts: prepareOptions(input.accounts, transaction?.accountId),
    categories: prepareOptions(input.categories, transaction?.categoryId),
    date: transaction === undefined ? "" : localization.formatDate(transaction.date),
    description: transaction?.description ?? "",
    payee: transaction?.payee ?? "",
    purpose: transaction?.purpose ?? "",
    amount: transaction === undefined ? "" : localization.formatAmount(transaction.amountCents),
    statuses: [
      {
        value: "booked",
        label: localization.text("transaction.booked"),
        selected: transaction?.status === "booked",
      },
      {
        value: "planned",
        label: localization.text("transaction.planned"),
        selected: transaction?.status === "planned",
      },
    ],
    fixedCostChecked: transaction?.fixedCost === true,
    note: transaction?.note ?? "",
  };
}

export function prepareTransactionsViewModel(
  input: {
    accounts: Account[];
    categories: Category[];
    ownerContexts: OwnerContextLabel[];
    transactions: Transaction[];
    filters: TransactionFilters;
    formError?: string;
  },
  localization: Localization,
) {
  return {
    text: transactionText(localization),
    form: prepareTransactionFormViewModel(input, localization),
    filters: {
      month: input.filters.month === undefined ? "" : localization.formatMonth(input.filters.month),
      accounts: prepareFilterOptions(
        input.accounts,
        input.filters.accountId,
        localization.text("common.allAccounts"),
      ),
      ownerContexts: prepareFilterOptions(
        input.ownerContexts.map(({ ownerContext: id, label }) => ({ id, name: label })),
        input.filters.ownerContext,
        localization.text("common.allOwners"),
      ),
      categories: prepareFilterOptions(
        input.categories,
        input.filters.categoryId,
        localization.text("common.allCategories"),
      ),
      statuses: prepareFilterOptions(
        [
          { id: "booked", name: localization.text("transaction.booked") },
          { id: "planned", name: localization.text("transaction.planned") },
        ],
        input.filters.status,
        localization.text("transaction.allStatuses"),
      ),
      fixedCosts: prepareFilterOptions(
        [
          { id: "fixed", name: localization.text("common.fixed") },
          { id: "variable", name: localization.text("common.variable") },
        ],
        input.filters.fixedCost === undefined
          ? undefined
          : input.filters.fixedCost
            ? "fixed"
            : "variable",
        localization.text("transaction.allCosts"),
      ),
      internalTransfers: prepareFilterOptions(
        [
          { id: "marked", name: localization.text("transaction.marked") },
          { id: "unmarked", name: localization.text("transaction.unmarked") },
        ],
        input.filters.internalTransfer === undefined
          ? undefined
          : input.filters.internalTransfer
            ? "marked"
            : "unmarked",
        localization.text("transaction.allTransactions"),
      ),
    },
    list: prepareTransactionListViewModel(input, localization),
  };
}

function prepareOptions(
  values: { id: string; name: string }[],
  selectedValue: string | undefined,
): SelectOption[] {
  return values.map(({ id, name }) => ({
    value: id,
    label: name,
    selected: selectedValue === id,
  }));
}

function prepareFilterOptions(
  values: { id: string; name: string }[],
  selectedValue: string | undefined,
  emptyLabel: string,
): SelectOption[] {
  return [
    { value: "", label: emptyLabel, selected: selectedValue === undefined },
    ...prepareOptions(values, selectedValue),
  ];
}
