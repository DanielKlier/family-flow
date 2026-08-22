import type {
  OidcTransaction,
  OidcTransactionStore,
} from "../../ports/auth/oidc-transaction-store.js";

export class InMemoryOidcTransactionStore implements OidcTransactionStore {
  private readonly transactions = new Map<string, OidcTransaction>();

  async create(transaction: OidcTransaction): Promise<void> {
    this.transactions.set(transaction.state, copy(transaction));
  }

  async consumeByState(state: string, consumedAt: Date): Promise<OidcTransaction | null> {
    const transaction = this.transactions.get(state);
    if (
      transaction === undefined ||
      transaction.consumedAt !== null ||
      transaction.expiresAt <= consumedAt
    ) {
      return null;
    }
    transaction.consumedAt = new Date(consumedAt);
    return copy(transaction);
  }
}

function copy(transaction: OidcTransaction): OidcTransaction {
  return {
    ...transaction,
    createdAt: new Date(transaction.createdAt),
    expiresAt: new Date(transaction.expiresAt),
    consumedAt: transaction.consumedAt === null ? null : new Date(transaction.consumedAt),
  };
}
