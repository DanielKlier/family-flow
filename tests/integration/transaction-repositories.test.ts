import { describe, expect, it } from "vitest";

import { InMemoryTransactionRepository } from "../../src/adapters/db/in-memory-transaction-repository.js";
import { createInitialAccounts } from "../../src/adapters/db/seeds/master-data.js";
import { createGermanLocalization } from "../../src/adapters/localization/german.js";

const initialAccounts = createInitialAccounts(createGermanLocalization());
import { expectTransactionFilterContract } from "../support/transaction-repository-contract.js";
import { aTransaction } from "../support/transactions.js";

describe("transaction repositories", () => {
  it("stores, filters, updates, and deletes transactions", async () => {
    const repository = new InMemoryTransactionRepository(initialAccounts);
    const groceries = aTransaction({
      id: "transaction-groceries",
    });
    const rent = aTransaction({
      id: "transaction-rent",
      accountId: "account-shared-checking",
      categoryId: "category-housing-rent",
      date: "2026-07-01",
      amountCents: -120000,
      description: "Rent",
      payee: "Landlord",
      status: "planned",
      fixedCost: true,
    });

    await repository.save(groceries);
    await repository.save(rent);

    await expect(repository.list({ month: "2026-07", ownerContext: "shared" })).resolves.toEqual([
      rent,
    ]);

    await repository.save({ ...groceries, description: "Weekly groceries", status: "planned" });
    await expect(repository.get("transaction-groceries")).resolves.toMatchObject({
      description: "Weekly groceries",
      status: "planned",
    });

    await repository.delete("transaction-rent");
    await expect(repository.list({})).resolves.toHaveLength(1);
  });

  it("filters marked and unmarked internal transfers", async () => {
    const repository = new InMemoryTransactionRepository(initialAccounts);
    const unmarked = aTransaction({ id: "transaction-unmarked-transfer" });
    const marked = {
      ...aTransaction({ id: "transaction-marked-transfer" }),
      internalTransfer: true,
    };

    await repository.save(unmarked);
    await repository.save(marked);

    await expect(
      repository.list({ internalTransfer: true } as Parameters<typeof repository.list>[0]),
    ).resolves.toEqual([marked]);
    await expect(
      repository.list({ internalTransfer: false } as Parameters<typeof repository.list>[0]),
    ).resolves.toEqual([unmarked]);
  });

  it("applies each transaction filter consistently", async () => {
    const repository = new InMemoryTransactionRepository(initialAccounts);
    await expectTransactionFilterContract(repository);
  });
});
