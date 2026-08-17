import { describe, expect, it } from "vitest";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";

const localization = createGermanLocalization();

describe("transaction view-model preparation", () => {
  it("prepares display-only transaction rows without transforming unsafe user text", async () => {
    const { prepareTransactionListViewModel } = await import(
      "../../src/adapters/http/transaction-view-model.js"
    );
    const model = prepareTransactionListViewModel(
      {
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
            purpose: '<img src=x onerror="globalThis.xssExecuted=true">',
            source: "manual",
            status: "planned",
            fixedCost: true,
            internalTransfer: false,
            note: "<strong>note</strong>",
            importHash: null,
          },
        ],
      },
      localization,
    );

    expect(model.rows).toEqual([
      {
        date: "15.07.2026",
        description: "<script>globalThis.xssExecuted = true</script>",
        purpose: '<img src=x onerror="globalThis.xssExecuted=true">',
        category: "missing-category",
        amount: "42,99",
        status: "geplant",
        fixedCostLabel: "fix",
        internalTransfer: false,
        internalTransferLabel: "",
        internalTransferUrl: "/transactions/transaction%2Fwith%20spaces/internal-transfer",
        internalTransferValue: "true",
        internalTransferAction: "Als Umbuchung markieren",
        editUrl: "/transactions/transaction%2Fwith%20spaces/edit",
        deleteUrl: "/transactions/transaction%2Fwith%20spaces/delete",
      },
    ]);
  });

  it("exposes persisted purposes and renders missing purposes as empty strings", async () => {
    const { prepareTransactionListViewModel } = await import(
      "../../src/adapters/http/transaction-view-model.js"
    );
    const model = prepareTransactionListViewModel(
      {
        categories: [],
        transactions: [
          {
            id: "transaction-with-purpose",
            accountId: "account-a",
            categoryId: "category-a",
            date: "2026-07-15",
            amountCents: -4299,
            description: "Card payment",
            payee: null,
            purpose: "Monthly groceries",
            source: "csv",
            status: "booked",
            fixedCost: false,
            internalTransfer: false,
            note: null,
            importHash: "hash-with-purpose",
          },
          {
            id: "transaction-without-purpose",
            accountId: "account-a",
            categoryId: "category-a",
            date: "2026-07-16",
            amountCents: -1000,
            description: "Cash withdrawal",
            payee: null,
            purpose: null,
            source: "csv",
            status: "booked",
            fixedCost: false,
            internalTransfer: false,
            note: null,
            importHash: "hash-without-purpose",
          },
        ],
      },
      localization,
    );

    expect(model.rows.map((row) => row.purpose)).toEqual(["Monthly groceries", ""]);
  });

  it("prepares selected options and fixed-cost labels for form models", async () => {
    const { prepareTransactionFormViewModel } = await import(
      "../../src/adapters/http/transaction-view-model.js"
    );
    const model = prepareTransactionFormViewModel(
      {
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
          purpose: null,
          source: "manual",
          status: "booked",
          fixedCost: false,
          internalTransfer: false,
          note: null,
          importHash: null,
        },
      },
      localization,
    );

    expect(model).toMatchObject({
      actionUrl: "/transactions/transaction-a",
      submitLabel: "Transaktion speichern",
      amount: "10,00",
      fixedCostChecked: false,
      accounts: [{ value: "account-a", label: "Personal", selected: true }],
      categories: [{ value: "category-groceries", label: "Groceries", selected: true }],
    });
  });
});
