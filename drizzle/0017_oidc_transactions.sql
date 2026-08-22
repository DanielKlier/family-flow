CREATE TABLE oidc_transactions (
  id text PRIMARY KEY,
  state text NOT NULL UNIQUE,
  nonce text NOT NULL,
  return_to text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX oidc_transactions_expiry_idx ON oidc_transactions (expires_at);
