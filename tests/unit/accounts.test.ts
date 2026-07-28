import { describe, expect, it } from "vitest";

import { createAccount } from "../../src/core/accounts/account.js";

describe("Account", () => {
  it("creates an account with a valid owner context", () => {
    expect(
      createAccount({
        id: "account-shared-checking",
        name: "Shared checking",
        ownerContext: "shared",
      }),
    ).toEqual({
      id: "account-shared-checking",
      name: "Shared checking",
      ownerContext: "shared",
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
