import { describe, expect, it } from "vitest";

import { InMemoryTransactionRepository } from "../../src/adapters/db/in-memory-transaction-repository.js";
import {
  assertUniqueCategoryName,
  createCategory,
  normalizeCategoryName,
} from "../../src/core/categories/category.js";
import {
  createCategorizationRule,
  decideImportCategorization,
} from "../../src/core/categorization/categorization-rule.js";
import { reapplyCategorizationRules } from "../../src/core/categorization/reapply-categorization-rules.js";
import { createManualExpense, createTransaction } from "../../src/core/transactions/transaction.js";
import { aTransaction } from "../support/transactions.js";

describe("categorization correction", () => {
  it("UNIT-FF-CAT-004-01: canonicalizes category names and rejects normalized collisions", () => {
    expect(normalizeCategoryName("  Ｌｅｂｅｎｓｍｉｔｔｅｌ\tMarkt  ")).toBe("lebensmittel markt");
    expect(() =>
      assertUniqueCategoryName(
        [createCategory({ id: "category-one", name: "LEBENSMITTEL   Markt" })],
        createCategory({ id: "category-two", name: " Ｌｅｂｅｎｓｍｉｔｔｅｌ Markt " }),
      ),
    ).toThrow("Category name already exists");
  });

  it("selects CSV-mapped, rule, and fallback categories with authoritative origins", () => {
    const categories = [
      createCategory({ id: "category-groceries", name: "Lebensmittel" }),
      createCategory({ id: "category-other", name: "Sonstiges" }),
    ];
    const rule = createCategorizationRule({
      id: "rule-market",
      name: "Market",
      searchText: "market",
      categoryId: "category-groceries",
      fixedCost: true,
      priority: 1,
      enabled: true,
    });
    const candidate = {
      accountId: "account",
      description: "Market purchase",
      payee: null,
      purpose: null,
    };

    expect(
      decideImportCategorization(categories, [rule], candidate, " ＬＥＢＥＮＳＭＩＴＴＥＬ "),
    ).toMatchObject({ id: "category-groceries", origin: "csv_mapped", fixedCost: true });
    expect(decideImportCategorization(categories, [rule], candidate, "Unknown")).toMatchObject({
      id: "category-groceries",
      origin: "rule",
      fixedCost: true,
    });
    expect(decideImportCategorization(categories, [], candidate, "Unknown")).toMatchObject({
      id: "category-other",
      origin: "fallback",
      fixedCost: false,
    });
  });

  it("requires a valid category origin and assigns manual origin during manual creation", () => {
    expect(
      createManualExpense({
        id: "manual",
        accountId: "account",
        categoryId: "category",
        date: "2026-01-01",
        amountCents: -100,
        description: "Expense",
      }).categoryOrigin,
    ).toBe("manual");
    expect(() =>
      createTransaction({
        id: "missing-origin",
        accountId: "account",
        categoryId: "category",
        date: "2026-01-01",
        amountCents: -100,
        description: "Expense",
        payee: null,
        source: "csv",
        status: "booked",
        fixedCost: false,
        note: null,
      } as Parameters<typeof createTransaction>[0]),
    ).toThrow("invalid_category_origin");
  });

  it("UNIT-FF-CAT-005-02: reapplies in stable ID order and reports origin-aware changes", async () => {
    const savedIds: string[] = [];
    const transactions = [
      aTransaction({
        id: "transaction-z",
        description: "Market booked",
        categoryId: "category-other",
        categoryOrigin: "fallback",
      }),
      aTransaction({
        id: "transaction-a",
        description: "No matching rule planned",
        payee: null,
        purpose: null,
        status: "planned",
        categoryOrigin: "fallback",
      }),
      aTransaction({
        id: "transaction-m",
        description: "Market manual",
        categoryId: "category-housing-rent",
        categoryOrigin: "manual",
      }),
    ];
    const repository = new InMemoryTransactionRepository([], transactions);
    const originalSave = repository.save.bind(repository);
    repository.save = async (transaction) => {
      savedIds.push(transaction.id);
      await originalSave(transaction);
    };
    const rule = createCategorizationRule({
      id: "rule-market",
      name: "Market",
      searchText: "market",
      categoryId: "category-groceries",
      fixedCost: true,
      priority: 1,
      enabled: true,
    });

    await expect(reapplyCategorizationRules([rule], repository)).resolves.toEqual({
      changed: 2,
      unchanged: 1,
    });
    expect(savedIds).toEqual(["transaction-m", "transaction-z"]);
    await expect(repository.get("transaction-m")).resolves.toMatchObject({
      categoryId: "category-housing-rent",
      categoryOrigin: "manual",
      fixedCost: true,
    });
    await expect(repository.get("transaction-z")).resolves.toMatchObject({
      categoryId: "category-groceries",
      categoryOrigin: "rule",
      fixedCost: true,
    });
  });
});
