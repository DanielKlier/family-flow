CREATE TABLE IF NOT EXISTS categorization_rules (
  id text PRIMARY KEY,
  name text NOT NULL,
  search_text text NOT NULL,
  category_id text NOT NULL REFERENCES categories(id),
  account_id text REFERENCES accounts(id),
  priority integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true
);
