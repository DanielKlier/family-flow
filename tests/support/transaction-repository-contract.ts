import { expect } from "vitest";

import type { TransactionRepository } from "../../src/ports/repositories/transaction-repository.js";
import { aTransaction } from "./transactions.js";

export async function expectTransactionFilterContract(
  repository: TransactionRepository,
): Promise<void> {
  const groceries = aTransaction({
    id: "transaction-filter-groceries",
    accountId: "account-person-a-checking",
    categoryId: "category-groceries",
    date: "2026-07-15",
    description: "Filter groceries",
  });
  const rent = aTransaction({
    id: "transaction-filter-rent",
    accountId: "account-shared-checking",
    categoryId: "category-housing-rent",
    date: "2026-08-01",
    amountCents: -120000,
    description: "Filter rent",
    status: "planned",
    fixedCost: true,
  });

  await repository.save(groceries);
  await repository.save(rent);

  await expect(repository.list({ month: "2026-07" })).resolves.toEqual([groceries]);
  await expect(repository.list({ accountId: "account-shared-checking" })).resolves.toEqual([rent]);
  await expect(repository.list({ categoryId: "category-groceries" })).resolves.toEqual([groceries]);
  await expect(repository.list({ status: "planned" })).resolves.toEqual([rent]);
  await expect(repository.list({ fixedCost: true })).resolves.toEqual([rent]);
  await expect(repository.list({ fixedCost: false })).resolves.toEqual([groceries]);
  await expect(repository.list({ ownerContext: "person_a" })).resolves.toEqual([groceries]);
}
