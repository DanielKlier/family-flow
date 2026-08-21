import { describe, expect, it } from "vitest";
import { InMemoryCategorizationRuleRepository } from "../../src/adapters/db/in-memory-categorization-rule-repository.js";
import { createCategorizationRule } from "../../src/core/categorization/categorization-rule.js";
import { compareCodePoints } from "../../src/core/shared/compare-code-points.js";

describe("categorization rule repositories", () => {
  it("stores, lists, gets, and deletes categorization rules", async () => {
    const repository = new InMemoryCategorizationRuleRepository();
    const groceries = createCategorizationRule({
      id: "rule-groceries",
      name: "Groceries",
      searchText: "supermarket",
      categoryId: "category-groceries",
      priority: 10,
      enabled: true,
    });
    const rent = createCategorizationRule({
      id: "rule-rent",
      name: "Rent",
      searchText: "landlord",
      categoryId: "category-housing-rent",
      fixedCost: true,
      priority: 1,
      enabled: true,
    });

    await repository.save(groceries);
    await repository.save(rent);

    await expect(repository.list()).resolves.toEqual([rent, groceries]);
    await expect(repository.get("rule-groceries")).resolves.toEqual(groceries);

    await repository.delete("rule-rent");

    await expect(repository.list()).resolves.toEqual([groceries]);
  });

  it("INT-FF-CAT-005-02: lists equal-priority rules by stable code-point ID order", async () => {
    const ids = ["rule-a", "rule-A", "rule-!", "rule-_", "rule-b"];
    const repository = new InMemoryCategorizationRuleRepository(
      ids.map((id) =>
        createCategorizationRule({
          id,
          name: `${id} display name`,
          searchText: "market",
          categoryId: "category-other",
          priority: 1,
          enabled: true,
        }),
      ),
    );

    expect((await repository.list()).map(({ id }) => id)).toEqual([
      "rule-!",
      "rule-A",
      "rule-_",
      "rule-a",
      "rule-b",
    ]);
  });

  it("INT-FF-CAT-002-01: round-trips mark, unmark, and unchanged transfer actions", async () => {
    const repository = new InMemoryCategorizationRuleRepository();
    const actions = [
      ["rule-mark-transfer", true],
      ["rule-unmark-transfer", false],
      ["rule-unchanged-transfer", null],
    ] as const;

    for (const [id, internalTransfer] of actions) {
      await repository.save(
        createCategorizationRule({
          id,
          name: id,
          searchText: "settlement",
          categoryId: "category-other",
          internalTransfer,
          priority: 1,
          enabled: true,
        }),
      );
    }

    expect(
      (await repository.list()).map(({ id, internalTransfer }) => ({ id, internalTransfer })),
    ).toEqual(
      actions
        .map(([id, internalTransfer]) => ({ id, internalTransfer }))
        .sort((left, right) => compareCodePoints(left.id, right.id)),
    );
  });
});
