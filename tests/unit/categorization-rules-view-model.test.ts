import { describe, expect, it } from "vitest";

describe("categorization-rules view-model preparation", () => {
  it("prepares lookup fallbacks, selected options, explicit fixed-cost state, and encoded actions", async () => {
    const { prepareCategorizationRuleEditViewModel, prepareCategorizationRulesViewModel } =
      await import("../../src/adapters/http/categorization-rules-view-model.js");
    const rule = {
      id: "rule/a b",
      name: "<script>rule</script>",
      searchText: '" onfocus="alert(1)',
      categoryId: "missing-category",
      accountId: null,
      fixedCost: null,
      internalTransfer: null,
      priority: 3,
      enabled: false,
    };
    const input = { accounts: [], categories: [], rules: [rule] };

    expect(prepareCategorizationRulesViewModel(input).rows).toEqual([
      expect.objectContaining({
        name: "<script>rule</script>",
        searchText: '" onfocus="alert(1)',
        category: "missing-category",
        fixedCostLabel: "leave unchanged",
        enabled: false,
        editUrl: "/categorization-rules/rule%2Fa%20b/edit",
        deleteUrl: "/categorization-rules/rule%2Fa%20b/delete",
      }),
    ]);
    expect(prepareCategorizationRuleEditViewModel({ ...input, rule })).toMatchObject({
      actionUrl: "/categorization-rules/rule%2Fa%20b",
      fixedCostOptions: expect.any(Array),
      enabledChecked: false,
    });
  });
});
