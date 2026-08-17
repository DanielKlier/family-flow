import { describe, expect, it } from "vitest";

import { createAccount, updateAccount } from "../../src/core/accounts/account.js";

describe("Account", () => {
  it("creates an account with a valid owner context", () => {
    expect(
      createAccount({
        id: "account-shared-checking",
        name: "Gemeinsames Girokonto",
        ownerContext: "shared",
      }),
    ).toEqual({
      id: "account-shared-checking",
      name: "Gemeinsames Girokonto",
      ownerContext: "shared",
      active: true,
    });
  });

  it("updates account editable fields", () => {
    expect(
      updateAccount(
        createAccount({
          id: "account-shared-checking",
          name: "Gemeinsames Girokonto",
          ownerContext: "shared",
        }),
        {
          name: "Renamed checking",
          ownerContext: "person_a",
          active: false,
        },
      ),
    ).toEqual({
      id: "account-shared-checking",
      name: "Renamed checking",
      ownerContext: "person_a",
      active: false,
    });
  });

  it("rejects an empty account name", () => {
    expect(() =>
      createAccount({
        id: "account-shared-checking",
        name: " ",
        ownerContext: "shared",
      }),
    ).toThrow("Account name is required");
  });
});
