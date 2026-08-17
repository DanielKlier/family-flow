import { describe, expect, it } from "vitest";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";

const localization = createGermanLocalization();

describe("income view-model preparation", () => {
  it("prepares formatted amounts, selected filters, raw user values, and encoded edit URLs", async () => {
    const { prepareIncomeEditViewModel, prepareIncomeViewModel } = await import(
      "../../src/adapters/http/income-view-model.js"
    );
    const plan = {
      id: "income/a b",
      ownerContext: "person_a" as const,
      name: "<script>salary</script>",
      amountCents: 350000,
      startMonth: "2026-01",
      endMonth: null,
      active: true,
    };
    const ownerContexts = [{ ownerContext: "person_a" as const, label: "Person A" }];
    const input = {
      plans: [plan],
      allPlans: [plan],
      overrides: [
        {
          id: "override",
          incomePlanId: plan.id,
          month: "2026-08",
          amountCents: 180000,
          note: '<img onerror="alert(1)">',
        },
      ],
      ownerContexts,
      filters: { month: "2026-08", ownerContext: "person_a" as const },
      monthlyIncome: {
        month: "2026-08",
        totalCents: 180000,
        entries: [{ incomePlanId: plan.id, name: plan.name, amountCents: 180000 }],
      },
    };

    expect(prepareIncomeViewModel(input, localization)).toMatchObject({
      monthlyIncomeLabel: "Geplante Monatseinnahmen: 1.800,00",
      rows: [
        expect.objectContaining({
          name: "<script>salary</script>",
          amount: "3.500,00",
          editUrl: "/income/income%2Fa%20b/edit",
        }),
      ],
      ownerContexts: expect.arrayContaining([{ value: "person_a", selected: true }]),
    });
    expect(prepareIncomeEditViewModel({ plan, ownerContexts }, localization)).toMatchObject({
      actionUrl: "/income/income%2Fa%20b",
      amount: "3.500,00",
      activeChecked: true,
    });
  });
});
