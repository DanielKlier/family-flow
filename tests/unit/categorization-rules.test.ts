import { describe, expect, it } from "vitest";

import {
  applyCategorizationRules,
  createCategorizationRule,
  findCategorizationMatch,
} from "../../src/core/categorization/categorization-rule.js";
import { createTransaction } from "../../src/core/transactions/transaction.js";

describe("categorization rules", () => {
  it("creates a valid categorization rule", () => {
    expect(
      createCategorizationRule({
        id: "rule-groceries",
        name: " Groceries ",
        searchText: " supermarket ",
        categoryId: " category-groceries ",
        accountId: " checking ",
        priority: 10,
        enabled: true,
      }),
    ).toEqual({
      id: "rule-groceries",
      name: "Groceries",
      searchText: "supermarket",
      categoryId: "category-groceries",
      accountId: "checking",
      fixedCost: null,
      internalTransfer: null,
      priority: 10,
      enabled: true,
    });
  });

  it("UNIT-FF-CAT-002-02: defaults an omitted internal-transfer action to leave state unchanged", () => {
    expect(
      createCategorizationRule({
        id: "rule-unchanged-transfer",
        name: "Unchanged transfer",
        searchText: "settlement",
        categoryId: "category-other",
        priority: 1,
        enabled: true,
      }),
    ).toMatchObject({ internalTransfer: null });
  });

  it("normalizes blank account restrictions to no restriction", () => {
    expect(
      createCategorizationRule({
        id: "rule-any-account",
        name: "Any account",
        searchText: "rent",
        categoryId: "category-rent",
        accountId: " ",
        priority: 1,
        enabled: true,
      }).accountId,
    ).toBeNull();
  });

  it("rejects invalid rule data", () => {
    expect(() =>
      createCategorizationRule({
        id: "rule-invalid",
        name: "Invalid",
        searchText: " ",
        categoryId: "category-groceries",
        accountId: null,
        priority: 1,
        enabled: true,
      }),
    ).toThrow("Categorization rule search text is required");
  });

  it("UNIT-FF-CAT-001-01: matches normalized description, payee, and purpose only for enabled account-compatible rules", () => {
    const rule = createCategorizationRule({
      id: "rule-normalized",
      name: "Normalized",
      searchText: "straße markt",
      categoryId: "category-groceries",
      accountId: "account-shared-checking",
      priority: 1,
      enabled: true,
    });

    for (const candidate of [
      { description: "Die STRAẞE   MARKT Bestellung", payee: null, purpose: null },
      { description: "Card payment", payee: "STRAẞE   MARKT", purpose: null },
      { description: "Card payment", payee: null, purpose: "ＳＴＲＡẞＥ   MARKT" },
    ]) {
      expect(
        findCategorizationMatch([rule], { accountId: "account-shared-checking", ...candidate }),
      ).toBe(rule);
    }

    expect(
      findCategorizationMatch([rule], {
        accountId: "account-other",
        description: "STRAẞE MARKT",
        payee: null,
        purpose: null,
      }),
    ).toBeNull();
    expect(
      findCategorizationMatch([{ ...rule, enabled: false }], {
        accountId: "account-shared-checking",
        description: "STRAẞE MARKT",
        payee: null,
        purpose: null,
      }),
    ).toBeNull();
    expect(
      findCategorizationMatch([rule], {
        accountId: "account-shared-checking",
        description: "Unrelated",
        payee: null,
        purpose: null,
      }),
    ).toBeNull();
  });

  it("matches enabled rules case-insensitively against description and payee", () => {
    const match = findCategorizationMatch(
      [
        createCategorizationRule({
          id: "rule-disabled",
          name: "Disabled",
          searchText: "market",
          categoryId: "category-disabled",
          priority: 1,
          enabled: false,
        }),
        createCategorizationRule({
          id: "rule-groceries",
          name: "Groceries",
          searchText: "supermarket",
          categoryId: "category-groceries",
          priority: 10,
          enabled: true,
        }),
      ],
      {
        accountId: "checking",
        description: "Weekly SUPERMARKET purchase",
        payee: null,
      },
    );

    expect(match?.categoryId).toBe("category-groceries");
  });

  it("chooses the highest priority matching rule", () => {
    const match = findCategorizationMatch(
      [
        createCategorizationRule({
          id: "rule-low",
          name: "Low",
          searchText: "market",
          categoryId: "category-low",
          priority: 20,
          enabled: true,
        }),
        createCategorizationRule({
          id: "rule-high",
          name: "High",
          searchText: "farmers market",
          categoryId: "category-high",
          priority: 5,
          enabled: true,
        }),
      ],
      {
        accountId: "checking",
        description: "Farmers Market",
        payee: null,
      },
    );

    expect(match?.id).toBe("rule-high");
  });

  it("UNIT-FF-CAT-003-01: selects the lowest numeric priority and then ASCII rule ID regardless of candidate order", () => {
    const rules = [
      createCategorizationRule({
        id: "rule-B",
        name: "Aardvark",
        searchText: "market",
        categoryId: "category-b",
        priority: 1,
        enabled: true,
      }),
      createCategorizationRule({
        id: "rule-low-priority",
        name: "First by name",
        searchText: "market",
        categoryId: "category-low-priority",
        priority: 2,
        enabled: true,
      }),
      createCategorizationRule({
        id: "rule-A",
        name: "Zebra",
        searchText: "market",
        categoryId: "category-a",
        priority: 1,
        enabled: true,
      }),
    ];
    const candidate = { accountId: "account-shared-checking", description: "Market", payee: null };

    expect(findCategorizationMatch(rules, candidate)?.id).toBe("rule-A");
    expect(findCategorizationMatch([...rules].reverse(), candidate)?.id).toBe("rule-A");
  });

  it("UNIT-FF-CAT-002-01: protects manual, CSV-mapped, and legacy categories while applying rule actions", () => {
    const rule = createCategorizationRule({
      id: "rule-market",
      name: "Market actions",
      searchText: "market",
      categoryId: "category-groceries",
      fixedCost: true,
      internalTransfer: true,
      priority: 1,
      enabled: true,
    });
    const protectedTransaction = Object.assign(
      createTransaction({
        id: "transaction-csv-mapped",
        accountId: "account-shared-checking",
        categoryId: "category-housing-rent",
        date: "2026-07-15",
        amountCents: -4299,
        description: "Market payment",
        payee: null,
        categoryOrigin: "fallback",
        source: "csv",
        status: "booked",
        fixedCost: false,
        internalTransfer: false,
        note: null,
      }),
      { categoryOrigin: "csv_mapped" },
    );

    const protectedTransactions = [
      protectedTransaction,
      Object.assign(
        { ...protectedTransaction, id: "transaction-manual" },
        { categoryOrigin: "manual" },
      ),
      Object.assign(
        { ...protectedTransaction, id: "transaction-legacy" },
        { categoryOrigin: "legacy_preserved" },
      ),
    ];
    const recalculableTransactions = [
      Object.assign(
        { ...protectedTransaction, id: "transaction-rule", categoryId: "category-other" },
        { categoryOrigin: "rule" },
      ),
      Object.assign(
        { ...protectedTransaction, id: "transaction-fallback", categoryId: "category-other" },
        { categoryOrigin: "fallback" },
      ),
    ];

    expect(
      applyCategorizationRules([rule], [...protectedTransactions, ...recalculableTransactions]),
    ).toEqual([
      ...protectedTransactions.map((transaction) => ({
        ...transaction,
        fixedCost: true,
        internalTransfer: true,
      })),
      ...recalculableTransactions.map((transaction) => ({
        ...transaction,
        categoryId: "category-groceries",
        categoryOrigin: "rule",
        fixedCost: true,
        internalTransfer: true,
      })),
    ]);
    expect(
      applyCategorizationRules(
        [rule],
        [{ ...protectedTransaction, description: "No matching rule" }],
      ),
    ).toEqual([{ ...protectedTransaction, description: "No matching rule" }]);
  });

  it("applies matching rules to existing transactions", () => {
    const transaction = createTransaction({
      id: "transaction-supermarket",
      accountId: "account-shared-checking",
      categoryId: "category-other",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Supermarket purchase",
      payee: "Shop",
      categoryOrigin: "rule",
      source: "manual",
      status: "booked",
      fixedCost: false,
      note: null,
    });

    expect(
      applyCategorizationRules(
        [
          createCategorizationRule({
            id: "rule-groceries",
            name: "Groceries",
            searchText: "supermarket",
            categoryId: "category-groceries",
            priority: 1,
            enabled: true,
          }),
        ],
        [transaction],
      ),
    ).toEqual([{ ...transaction, categoryId: "category-groceries" }]);
  });

  it("applies a mark transfer action from a matching rule", () => {
    const unmarked = createTransaction({
      id: "transaction-unmarked-transfer",
      accountId: "account-shared-checking",
      categoryId: "category-other",
      date: "2026-07-01",
      amountCents: -4200,
      description: "Monthly settlement",
      payee: "Bank",
      categoryOrigin: "rule",
      source: "manual",
      status: "booked",
      fixedCost: false,
      internalTransfer: false,
      note: null,
    });
    expect(
      applyCategorizationRules(
        [
          createCategorizationRule({
            id: "rule-mark-transfer",
            name: "Mark transfer",
            searchText: "settlement",
            categoryId: "category-other",
            internalTransfer: true,
            priority: 1,
            enabled: true,
          }),
        ],
        [unmarked],
      ),
    ).toEqual([{ ...unmarked, internalTransfer: true }]);
  });

  it("applies an unmark transfer action from a matching rule", () => {
    const marked = createTransaction({
      id: "transaction-marked-transfer",
      accountId: "account-shared-checking",
      categoryId: "category-other",
      date: "2026-07-01",
      amountCents: -4200,
      description: "Monthly settlement",
      payee: "Bank",
      categoryOrigin: "rule",
      source: "manual",
      status: "booked",
      fixedCost: false,
      internalTransfer: true,
      note: null,
    });

    expect(
      applyCategorizationRules(
        [
          createCategorizationRule({
            id: "rule-unmark-transfer",
            name: "Unmark transfer",
            searchText: "settlement",
            categoryId: "category-other",
            internalTransfer: false,
            priority: 1,
            enabled: true,
          }),
        ],
        [marked],
      ),
    ).toEqual([{ ...marked, internalTransfer: false }]);
  });

  it("preserves transfer state when a matching rule leaves it unchanged", () => {
    const marked = createTransaction({
      id: "transaction-preserved-transfer",
      accountId: "account-shared-checking",
      categoryId: "category-other",
      date: "2026-07-01",
      amountCents: -4200,
      description: "Monthly settlement",
      payee: "Bank",
      categoryOrigin: "rule",
      source: "manual",
      status: "booked",
      fixedCost: false,
      internalTransfer: true,
      note: null,
    });

    expect(
      applyCategorizationRules(
        [
          createCategorizationRule({
            id: "rule-unchanged-transfer",
            name: "Unchanged transfer",
            searchText: "settlement",
            categoryId: "category-other",
            priority: 1,
            enabled: true,
          }),
        ],
        [marked],
      ),
    ).toEqual([marked]);
  });

  it("uses the winning rule's transfer action", () => {
    const transaction = createTransaction({
      id: "transaction-winning-transfer",
      accountId: "account-shared-checking",
      categoryId: "category-other",
      date: "2026-07-01",
      amountCents: -4200,
      description: "Monthly settlement",
      payee: "Bank",
      categoryOrigin: "rule",
      source: "manual",
      status: "booked",
      fixedCost: false,
      internalTransfer: false,
      note: null,
    });

    expect(
      applyCategorizationRules(
        [
          createCategorizationRule({
            id: "rule-lower-priority",
            name: "Lower priority",
            searchText: "settlement",
            categoryId: "category-other",
            internalTransfer: false,
            priority: 10,
            enabled: true,
          }),
          createCategorizationRule({
            id: "rule-higher-priority",
            name: "Higher priority",
            searchText: "settlement",
            categoryId: "category-other",
            internalTransfer: true,
            priority: 1,
            enabled: true,
          }),
        ],
        [transaction],
      ),
    ).toEqual([{ ...transaction, internalTransfer: true }]);
  });

  it("applies fixed-cost actions from matching rules", () => {
    const transaction = createTransaction({
      id: "transaction-rent",
      accountId: "account-shared-checking",
      categoryId: "category-other",
      date: "2026-07-01",
      amountCents: -120000,
      description: "Monthly landlord payment",
      payee: "Landlord",
      categoryOrigin: "rule",
      source: "manual",
      status: "booked",
      fixedCost: false,
      note: null,
    });

    expect(
      applyCategorizationRules(
        [
          createCategorizationRule({
            id: "rule-rent",
            name: "Rent",
            searchText: "landlord",
            categoryId: "category-housing-rent",
            fixedCost: true,
            priority: 1,
            enabled: true,
          }),
        ],
        [transaction],
      ),
    ).toEqual([{ ...transaction, categoryId: "category-housing-rent", fixedCost: true }]);
  });
});
