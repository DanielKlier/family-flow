import { describe, expect, it, vi } from "vitest";

import {
  maintainTransaction,
  TransactionMaintenanceError,
} from "../../src/core/transactions/transaction-maintenance.js";
import { aTransaction } from "../support/transactions.js";

const existingAccount = { id: "account-person-a-checking", active: false };
const existingCategory = { id: "category-groceries", active: false };

describe("transaction maintenance", () => {
  it("rejects unknown account and category references without saving", async () => {
    const save = vi.fn(async () => undefined);
    const persistence = {
      accounts: {
        get: vi.fn(async (id: string) => (id === existingAccount.id ? existingAccount : null)),
      },
      categories: {
        get: vi.fn(async (id: string) => (id === existingCategory.id ? existingCategory : null)),
      },
      transactions: { save },
    };

    await expect(
      maintainTransaction({
        transaction: aTransaction({ accountId: "missing-account" }),
        persistence,
      }),
    ).rejects.toBeInstanceOf(TransactionMaintenanceError);
    await expect(
      maintainTransaction({
        transaction: aTransaction({ categoryId: "missing-category" }),
        persistence,
      }),
    ).rejects.toMatchObject({ code: "unknown_category" });
    expect(save).not.toHaveBeenCalled();
  });

  it("saves canonical transactions when referenced inactive master data still exists", async () => {
    const transaction = aTransaction();
    const save = vi.fn(async () => undefined);

    await maintainTransaction({
      transaction,
      persistence: {
        accounts: { get: async () => existingAccount },
        categories: { get: async () => existingCategory },
        transactions: { save },
      },
    });

    expect(save).toHaveBeenCalledWith(transaction);
  });
});
