DO $$
DECLARE invalid_record record;
BEGIN
  SELECT account_id, import_hash, string_agg(id, ',' ORDER BY id) AS transaction_ids
    INTO invalid_record
    FROM transactions
   WHERE import_hash IS NOT NULL
     AND import_hash !~ '^([0-9a-f]{64}|v[23]:[0-9a-f]{64})$'
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

-- Unconsumed previews contain hashes produced by the identity version active at
-- preview time. Invalidate them so confirmation cannot persist stale v2 rows.
DELETE FROM import_preview_batches WHERE consumed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_account_import_hash_unique_idx
  ON transactions(account_id, import_hash) WHERE import_hash IS NOT NULL;
