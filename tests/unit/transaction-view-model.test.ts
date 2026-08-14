import { describe, expect, it } from "vitest";

describe("transaction view-model preparation", () => {
  it("prepares display-only transaction rows without transforming unsafe user text", async () => {
    const { prepareTransactionListViewModel } = await import(
      "../../src/adapters/http/transaction-view-model.js"
    );
    const model = prepareTransactionListViewModel({
      categories: [{ id: "category-groceries", name: "Groceries", active: true }],
      transactions: [
        {
          id: "transaction/with spaces",
          accountId: "account-a",
          categoryId: "missing-category",
          date: "2026-07-15",
          amountCents: -4299,
          description: "<script>globalThis.xssExecuted = true</script>",
          payee: '<img src=x onerror="globalThis.xssExecuted=true">',
          source: "manual",
          status: "planned",
          fixedCost: true,
          internalTransfer: false,
          note: "<strong>note</strong>",
          importHash: null,
        },
      ],
    });

    expect(model.rows).toEqual([
      {
        date: "2026-07-15",
        description: "<script>globalThis.xssExecuted = true</script>",
        category: "missing-category",
        amount: "42.99",
        status: "planned",
        fixedCostLabel: "fixed",
        internalTransfer: false,
        internalTransferLabel: "",
        internalTransferUrl: "/transactions/transaction%2Fwith%20spaces/internal-transfer",
        internalTransferValue: "true",
        internalTransferAction: "Mark as transfer",
        editUrl: "/transactions/transaction%2Fwith%20spaces/edit",
        deleteUrl: "/transactions/transaction%2Fwith%20spaces/delete",
      },
    ]);
  });

  it("prepares selected options and fixed-cost labels for form models", async () => {
    const { prepareTransactionFormViewModel } = await import(
      "../../src/adapters/http/transaction-view-model.js"
    );
    const model = prepareTransactionFormViewModel({
      accounts: [{ id: "account-a", name: "Personal", ownerContext: "person_a", active: true }],
      categories: [{ id: "category-groceries", name: "Groceries", active: true }],
      transaction: {
        id: "transaction-a",
        accountId: "account-a",
        categoryId: "category-groceries",
        date: "2026-07-15",
        amountCents: -1000,
        description: "Rent",
        payee: null,
        source: "manual",
        status: "booked",
        fixedCost: false,
        internalTransfer: false,
        note: null,
        importHash: null,
      },
    });

    expect(model).toMatchObject({
      actionUrl: "/transactions/transaction-a",
      submitLabel: "Save transaction",
      amount: "10.00",
      fixedCostChecked: false,
      accounts: [{ value: "account-a", label: "Personal", selected: true }],
      categories: [{ value: "category-groceries", label: "Groceries", selected: true }],
    });
  });
});
