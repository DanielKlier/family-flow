import { parseOwnerContext, type OwnerContext } from "../shared/owner-context.js";

export type Account = {
  id: string;
  name: string;
  ownerContext: OwnerContext;
  active: boolean;
};

export type AccountInput = {
  id: string;
  name: string;
  ownerContext: string;
  active?: boolean;
};

export type AccountUpdateInput = {
  name: string;
  ownerContext: string;
  active: boolean;
};

export function createAccount(input: AccountInput): Account {
  const id = input.id.trim();
  const name = input.name.trim();

  if (id === "") {
    throw new Error("Account id is required");
  }

  if (name === "") {
    throw new Error("Account name is required");
  }

  return {
    id,
    name,
    ownerContext: parseOwnerContext(input.ownerContext),
    active: input.active ?? true,
  };
}

export function updateAccount(account: Account, input: AccountUpdateInput): Account {
  return createAccount({
    id: account.id,
    name: input.name,
    ownerContext: input.ownerContext,
    active: input.active,
  });
}
