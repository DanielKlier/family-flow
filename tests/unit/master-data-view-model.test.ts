import { describe, expect, it } from "vitest";

describe("master-data view-model preparation", () => {
  it("prepares primitive labels, encoded edit actions, active flags, and raw error text", async () => {
    const { prepareAccountEditViewModel, prepareMasterDataViewModel } = await import(
      "../../src/adapters/http/master-data-view-model.js"
    );
    const ownerContexts = [{ ownerContext: "person_a" as const, label: "Person <A>" }];

    expect(
      prepareAccountEditViewModel({
        account: {
          id: "account/a b",
          name: "<script>account</script>",
          ownerContext: "person_a",
          active: false,
        },
        ownerContexts,
        formError: '<img src=x onerror="alert(1)">',
      }),
    ).toMatchObject({
      actionUrl: "/admin/master-data/accounts/account%2Fa%20b",
      name: "<script>account</script>",
      activeChecked: false,
      formError: '<img src=x onerror="alert(1)">',
      ownerContexts: [{ value: "person_a", label: "Person <A>", selected: true }],
    });
    expect(
      prepareMasterDataViewModel({ accounts: [], categories: [], ownerContexts }),
    ).toMatchObject({ accountHeading: "Accounts", categoryHeading: "Categories" });
  });
});
