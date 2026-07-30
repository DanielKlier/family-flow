CREATE TABLE IF NOT EXISTS import_profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  delimiter text NOT NULL,
  encoding text NOT NULL,
  date_column text NOT NULL,
  amount_column text NOT NULL,
  description_column text NOT NULL,
  payee_column text,
  category_column text
);
