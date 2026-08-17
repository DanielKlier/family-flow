import { describe, expect, it } from "vitest";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";

const localization = createGermanLocalization();

describe("CSV import view-model preparation", () => {
  it("prepares encoded profile links, primitive mapping values, formatted preview values, and raw errors", async () => {
    const { prepareCsvImportViewModel } = await import(
      "../../src/adapters/http/csv-import-view-model.js"
    );
    const profile = {
      id: "profile/a b",
      name: "<script>profile</script>",
      kind: "custom" as const,
      delimiter: ";",
      encoding: "latin1" as const,
      dateColumn: "Date",
      amountColumn: "Amount",
      descriptionColumn: "Description",
      payeeColumn: "Payee",
      categoryColumn: null,
    };

    expect(
      prepareCsvImportViewModel(
        {
          accounts: [
            { id: "account/a b", name: "Shared <account>", ownerContext: "shared", active: true },
          ],
          categories: [{ id: "category", name: "<script>category</script>", active: true }],
          importProfiles: [profile],
          selectedProfile: profile,
          profileSaved: true,
          formError: '<img src=x onerror="alert(1)">',
          previewRows: [
            {
              accountId: "account/a b",
              categoryId: "category",
              categoryName: "<script>category</script>",
              date: "2026-07-15",
              amountCents: -4299,
              description: "<script>description</script>",
              payee: '<img onerror="alert(1)">',
              fixedCost: false,
              importHash: "hash",
              duplicate: false,
            },
          ],
        },
        localization,
      ),
    ).toMatchObject({
      profileId: "profile/a b",
      selectedProfileUrl: "/imports/csv?profileId=profile%2Fa%20b",
      profileSaved: true,
      formError: '<img src=x onerror="alert(1)">',
      previewRows: [
        expect.objectContaining({
          amount: "42,99",
          description: "<script>description</script>",
          duplicateLabel: "neu",
        }),
      ],
    });

    expect(
      prepareCsvImportViewModel(
        {
          accounts: [],
          categories: [],
          importProfiles: [profile],
        },
        localization,
      ),
    ).not.toHaveProperty("profileId");
  });
});
