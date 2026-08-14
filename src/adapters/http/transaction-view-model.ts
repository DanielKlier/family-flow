import type { Account } from "../../core/accounts/account.js";
import type { Category } from "../../core/categories/category.js";
import type { OwnerContextLabel } from "../../core/shared/owner-context.js";
import type { Transaction } from "../../core/transactions/transaction.js";
import type { TransactionFilters } from "../../ports/repositories/transaction-repository.js";

type SelectOption = {
  value: string;
  label: string;
  selected: boolean;
};

type TransactionListInput = {
  categories: Category[];
  transactions: Transaction[];
};

export function prepareTransactionListViewModel(input: TransactionListInput) {
  const categoryNames = new Map(input.categories.map((category) => [category.id, category.name]));

  return {
    text: transactionText,
    empty: input.transactions.length === 0,
    rows: input.transactions.map((transaction) => ({
      date: transaction.date,
      description: transaction.description,
      category: categoryNames.get(transaction.categoryId) ?? transaction.categoryId,
      amount: formatExpenseAmount(transaction.amountCents),
      status: transaction.status,
      fixedCostLabel: transaction.fixedCost ? "fixed" : "variable",
      internalTransfer: transaction.internalTransfer,
      internalTransferLabel: transaction.internalTransfer ? "Internal transfer" : "",
      internalTransferUrl: `/transactions/${encodeURIComponent(transaction.id)}/internal-transfer`,
      internalTransferValue: transaction.internalTransfer ? "false" : "true",
      internalTransferAction: transaction.internalTransfer ? "Unmark transfer" : "Mark as transfer",
      editUrl: `/transactions/${encodeURIComponent(transaction.id)}/edit`,
      deleteUrl: `/transactions/${encodeURIComponent(transaction.id)}/delete`,
    })),
  };
}

const transactionText = {
  account: "Transaction account",
  category: "Category",
  date: "Date",
  description: "Description",
  payee: "Payee",
  purpose: "Purpose",
  amount: "Amount",
  status: "Transaction status",
  fixedCost: "Fixed cost",
  note: "Note",
  filtersHeading: "Filters",
  month: "Month",
  monthPlaceholder: "YYYY-MM",
  filterAccount: "Filter account",
  ownerContext: "Owner context",
  filterCategory: "Category",
  filterStatus: "Filter status",
  fixedCostFilter: "Fixed cost filter",
  internalTransferFilter: "Transfer state",
  applyFilters: "Apply filters",
  listHeading: "Transaction list",
  empty: "No transactions found.",
  actions: "Actions",
  edit: "Edit",
  delete: "Delete",
} as const;

export function prepareTransactionFormViewModel(input: {
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction;
  formError?: string;
}) {
  const transaction = input.transaction;

  return {
    text: transactionText,
    heading: transaction === undefined ? "Add transaction" : "Edit transaction",
    actionUrl:
      transaction === undefined
        ? "/transactions"
        : `/transactions/${encodeURIComponent(transaction.id)}`,
    submitLabel: transaction === undefined ? "Add transaction" : "Save transaction",
    create: transaction === undefined,
    formError: input.formError,
    accounts: prepareOptions(input.accounts, transaction?.accountId),
    categories: prepareOptions(input.categories, transaction?.categoryId),
    date: transaction?.date ?? "",
    description: transaction?.description ?? "",
    payee: transaction?.payee ?? "",
    purpose: transaction?.purpose ?? "",
    amount: transaction === undefined ? "" : formatExpenseAmount(transaction.amountCents),
    statuses: [
      { value: "booked", label: "booked", selected: transaction?.status === "booked" },
      { value: "planned", label: "planned", selected: transaction?.status === "planned" },
    ],
    fixedCostChecked: transaction?.fixedCost === true,
    note: transaction?.note ?? "",
  };
}

export function prepareTransactionsViewModel(input: {
  accounts: Account[];
  categories: Category[];
  ownerContexts: OwnerContextLabel[];
  transactions: Transaction[];
  filters: TransactionFilters;
  formError?: string;
}) {
  return {
    text: transactionText,
    form: prepareTransactionFormViewModel(input),
    filters: {
      month: input.filters.month ?? "",
      accounts: prepareFilterOptions(input.accounts, input.filters.accountId, "All accounts"),
      ownerContexts: prepareFilterOptions(
        input.ownerContexts.map(({ ownerContext: id, label }) => ({ id, name: label })),
        input.filters.ownerContext,
        "All owners",
      ),
      categories: prepareFilterOptions(
        input.categories,
        input.filters.categoryId,
        "All categories",
      ),
      statuses: prepareFilterOptions(
        [
          { id: "booked", name: "booked" },
          { id: "planned", name: "planned" },
        ],
        input.filters.status,
        "All statuses",
      ),
      fixedCosts: prepareFilterOptions(
        [
          { id: "fixed", name: "fixed" },
          { id: "variable", name: "variable" },
        ],
        input.filters.fixedCost === undefined
          ? undefined
          : input.filters.fixedCost
            ? "fixed"
            : "variable",
        "All costs",
      ),
      internalTransfers: prepareFilterOptions(
        [
          { id: "marked", name: "marked" },
          { id: "unmarked", name: "unmarked" },
        ],
        input.filters.internalTransfer === undefined
          ? undefined
          : input.filters.internalTransfer
            ? "marked"
            : "unmarked",
        "All transactions",
      ),
    },
    list: prepareTransactionListViewModel(input),
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

function formatExpenseAmount(amountCents: number): string {
  return (Math.abs(amountCents) / 100).toFixed(2);
}
