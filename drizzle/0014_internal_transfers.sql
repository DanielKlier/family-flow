ALTER TABLE transactions
  ADD COLUMN internal_transfer boolean NOT NULL DEFAULT false;
