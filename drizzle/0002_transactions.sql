CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id),
  category_id text NOT NULL REFERENCES categories(id),
  date text NOT NULL,
  amount_cents integer NOT NULL,
  description text NOT NULL,
  payee text,
  source text NOT NULL,
  status text NOT NULL,
  fixed_cost boolean NOT NULL DEFAULT false,
  note text,
  import_hash text
);

CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);
CREATE INDEX IF NOT EXISTS transactions_account_id_idx ON transactions(account_id);
CREATE INDEX IF NOT EXISTS transactions_category_id_idx ON transactions(category_id);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions(status);
