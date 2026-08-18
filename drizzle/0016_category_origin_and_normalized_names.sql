DO $$
DECLARE
  collision record;
BEGIN
  SELECT normalized_name, category_ids
  INTO collision
  FROM (
    SELECT
      lower(regexp_replace(trim(normalize(name, NFKC)), '\s+', ' ', 'g')) AS normalized_name,
      array_agg(id ORDER BY id) AS category_ids
    FROM categories
    GROUP BY lower(regexp_replace(trim(normalize(name, NFKC)), '\s+', ' ', 'g'))
    HAVING count(*) > 1
    ORDER BY normalized_name
    LIMIT 1
  ) collisions;

  IF FOUND THEN
    RAISE EXCEPTION 'Historical normalized category collision for category IDs %; see OPERATIONS.md categorization migration runbook', collision.category_ids;
  END IF;
END $$;

ALTER TABLE categories ADD COLUMN normalized_name text;
UPDATE categories
SET normalized_name = lower(regexp_replace(trim(normalize(name, NFKC)), '\s+', ' ', 'g'));
ALTER TABLE categories ALTER COLUMN normalized_name SET NOT NULL;
CREATE UNIQUE INDEX categories_normalized_name_unique_idx ON categories(normalized_name);

ALTER TABLE transactions
  ADD COLUMN category_origin text NOT NULL DEFAULT 'legacy_preserved';
UPDATE transactions
SET category_origin = CASE
  WHEN source = 'manual' THEN 'manual'
  WHEN source = 'csv' THEN 'legacy_preserved'
END;
ALTER TABLE transactions ALTER COLUMN category_origin DROP DEFAULT;
ALTER TABLE transactions ADD CONSTRAINT transactions_category_origin_check
  CHECK (category_origin IN ('manual', 'csv_mapped', 'rule', 'fallback', 'legacy_preserved'));

-- Existing unconsumed snapshots predate mandatory origin evidence and cannot be confirmed safely.
DELETE FROM import_preview_batches WHERE consumed_at IS NULL;
