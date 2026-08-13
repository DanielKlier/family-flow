ALTER TABLE transactions ADD COLUMN IF NOT EXISTS purpose text;

ALTER TABLE import_profiles ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'DD.MM.YYYY';
ALTER TABLE import_profiles ADD COLUMN IF NOT EXISTS decimal_format text NOT NULL DEFAULT 'comma-decimal';
ALTER TABLE import_profiles ADD COLUMN IF NOT EXISTS purpose_column text;

DO $$
DECLARE invalid_profile_ids text;
BEGIN
  SELECT string_agg(id, ',' ORDER BY id)
    INTO invalid_profile_ids
    FROM import_profiles
   WHERE kind <> 'custom'
      OR delimiter NOT IN (',', ';', E'\t')
      OR encoding NOT IN ('utf8', 'latin1')
      OR date_format NOT IN ('DD.MM.YY', 'DD.MM.YYYY', 'YYYY-MM-DD')
      OR decimal_format NOT IN ('comma-decimal', 'dot-decimal')
      OR btrim(name) = ''
      OR btrim(date_column) = ''
      OR btrim(amount_column) = ''
      OR btrim(description_column) = '';
  IF invalid_profile_ids IS NOT NULL THEN
    RAISE EXCEPTION 'invalid historical import profiles ids=% runbook=OPERATIONS.md#csv-import-problems remediation=correct the listed profile options and rerun pnpm db:migrate',
      invalid_profile_ids;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS import_preview_batches (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  account_id text NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  profile_snapshot jsonb NOT NULL,
  outcome_snapshot jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS import_preview_batches_expiry_idx
  ON import_preview_batches(expires_at) WHERE consumed_at IS NULL;

DO $$
DECLARE invalid_record record;
BEGIN
  SELECT account_id, import_hash, string_agg(id, ',' ORDER BY id) AS transaction_ids
    INTO invalid_record
    FROM transactions
   WHERE import_hash IS NOT NULL
     AND import_hash !~ '^(v2:)?[0-9a-f]{64}$'
   GROUP BY account_id, import_hash
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'invalid import hash account=% hash=% transactions=% runbook=OPERATIONS.md#csv-import-problems',
      invalid_record.account_id, invalid_record.import_hash, invalid_record.transaction_ids;
  END IF;

  SELECT account_id, import_hash, string_agg(id, ',' ORDER BY id) AS transaction_ids
    INTO invalid_record
    FROM transactions
   WHERE import_hash IS NOT NULL
   GROUP BY account_id, import_hash
  HAVING count(*) > 1
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'duplicate import hash account=% hash=% transactions=% runbook=OPERATIONS.md#csv-import-problems',
      invalid_record.account_id, invalid_record.import_hash, invalid_record.transaction_ids;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_account_import_hash_unique_idx
  ON transactions(account_id, import_hash) WHERE import_hash IS NOT NULL;
