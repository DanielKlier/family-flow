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

  it("applies matching rules to existing transactions", () => {
    const transaction = createTransaction({
      id: "transaction-supermarket",
      accountId: "account-shared-checking",
      categoryId: "category-other",
      date: "2026-07-15",
      amountCents: -4299,
      description: "Supermarket purchase",
      payee: "Shop",
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
