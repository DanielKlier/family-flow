export type OidcTransaction = {
  id: string;
  state: string;
  nonce: string;
  returnTo: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
};

export interface OidcTransactionStore {
  create(transaction: OidcTransaction): Promise<void>;
  consumeByState(state: string, consumedAt: Date): Promise<OidcTransaction | null>;
}

export interface OidcTokenGenerator {
  generate(): string;
}
