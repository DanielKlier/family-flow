import type {
  OidcTokenGenerator,
  OidcTransaction,
  OidcTransactionStore,
} from "../../ports/auth/oidc-transaction-store.js";
import type { Clock } from "../../ports/clock/clock.js";

const transactionLifetimeMilliseconds = 10 * 60 * 1_000;

export class OidcTransactionService {
  constructor(
    private readonly store: OidcTransactionStore,
    private readonly clock: Clock,
    private readonly tokens: OidcTokenGenerator,
  ) {}

  async create(returnTo: string): Promise<{ state: string; nonce: string }> {
    const state = this.tokens.generate();
    const nonce = this.tokens.generate();
    const createdAt = this.clock.now();
    await this.store.create({
      id: state,
      state,
      nonce,
      returnTo: safeReturnTo(returnTo),
      createdAt,
      expiresAt: new Date(createdAt.getTime() + transactionLifetimeMilliseconds),
      consumedAt: null,
    });
    return { state, nonce };
  }

  async consume(state: string): Promise<Omit<OidcTransaction, "id" | "consumedAt"> | null> {
    if (state === "") return null;
    const transaction = await this.store.consumeByState(state, this.clock.now());
    if (transaction === null) return null;
    return {
      state: transaction.state,
      nonce: transaction.nonce,
      returnTo: transaction.returnTo,
      createdAt: transaction.createdAt,
      expiresAt: transaction.expiresAt,
    };
  }
}

function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://family-flow.invalid");
    return url.origin === "https://family-flow.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : "/";
  } catch {
    return "/";
  }
}
