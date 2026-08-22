-- Emits deterministic, content-minimized backup/restore evidence as one JSON value.
-- Keep this inventory synchronized with application tables and recovery smoke coverage.
select jsonb_build_object(
  'schema_migrations', (
    select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
    from schema_migrations
  ),
  'counts', jsonb_build_object(
    'accounts', (select count(*) from accounts),
    'owner_context_labels', (select count(*) from owner_context_labels),
    'categories', (select count(*) from categories),
    'transactions', (select count(*) from transactions),
    'import_profiles', (select count(*) from import_profiles),
    'import_preview_batches', (select count(*) from import_preview_batches),
    'categorization_rules', (select count(*) from categorization_rules),
    'income_plans', (select count(*) from income_plans),
    'monthly_income_overrides', (select count(*) from monthly_income_overrides),
    'sessions', (select count(*) from sessions)
  ),
  'monetary_totals', jsonb_build_object(
    'transaction_total_cents', (select coalesce(sum(amount_cents), 0) from transactions),
    'income_plan_total_cents', (select coalesce(sum(amount_cents), 0) from income_plans),
    'monthly_override_total_cents', (
      select coalesce(sum(amount_cents), 0) from monthly_income_overrides
    )
  ),
  'references', jsonb_build_object(
    'transactions', (
      select coalesce(
        jsonb_agg(jsonb_build_array(id, account_id, category_id) order by id),
        '[]'::jsonb
      ) from transactions
    ),
    'import_previews', (
      select coalesce(jsonb_agg(jsonb_build_array(id, account_id) order by id), '[]'::jsonb)
      from import_preview_batches
    ),
    'categorization_rules', (
      select coalesce(
        jsonb_agg(jsonb_build_array(id, category_id, account_id) order by id),
        '[]'::jsonb
      ) from categorization_rules
    ),
    'monthly_overrides', (
      select coalesce(jsonb_agg(jsonb_build_array(id, income_plan_id) order by id), '[]'::jsonb)
      from monthly_income_overrides
    )
  ),
  'orphan_counts', jsonb_build_object(
    'transaction_accounts', (
      select count(*) from transactions child left join accounts parent on parent.id = child.account_id
      where parent.id is null
    ),
    'transaction_categories', (
      select count(*) from transactions child left join categories parent on parent.id = child.category_id
      where child.category_id is not null and parent.id is null
    ),
    'preview_accounts', (
      select count(*) from import_preview_batches child left join accounts parent on parent.id = child.account_id
      where parent.id is null
    ),
    'rule_accounts', (
      select count(*) from categorization_rules child left join accounts parent on parent.id = child.account_id
      where child.account_id is not null and parent.id is null
    ),
    'rule_categories', (
      select count(*) from categorization_rules child left join categories parent on parent.id = child.category_id
      where parent.id is null
    ),
    'override_plans', (
      select count(*) from monthly_income_overrides child left join income_plans parent on parent.id = child.income_plan_id
      where parent.id is null
    )
  ),
  'seed_inventory', jsonb_build_object(
    'accounts', (
      select coalesce(jsonb_agg(jsonb_build_array(id, name) order by id), '[]'::jsonb)
      from accounts where id like 'account-%'
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_array(id, name) order by id), '[]'::jsonb)
      from categories where id like 'category-%'
    ),
    'owner_context_labels', (
      select coalesce(
        jsonb_agg(jsonb_build_array(owner_context, label) order by owner_context),
        '[]'::jsonb
      ) from owner_context_labels
    )
  ),
  'active_states', jsonb_build_object(
    'accounts', (
      select coalesce(jsonb_agg(jsonb_build_array(id, active) order by id), '[]'::jsonb)
      from accounts
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_array(id, active) order by id), '[]'::jsonb)
      from categories
    ),
    'income_plans', (
      select coalesce(jsonb_agg(jsonb_build_array(id, active) order by id), '[]'::jsonb)
      from income_plans
    ),
    'categorization_rules', (
      select coalesce(jsonb_agg(jsonb_build_array(id, enabled) order by id), '[]'::jsonb)
      from categorization_rules
    )
  ),
  'ids', jsonb_build_object(
    'accounts', (select coalesce(jsonb_agg(id order by id), '[]'::jsonb) from accounts),
    'categories', (select coalesce(jsonb_agg(id order by id), '[]'::jsonb) from categories),
    'import_profiles', (
      select coalesce(jsonb_agg(id order by id), '[]'::jsonb) from import_profiles
    ),
    'sessions', (select coalesce(jsonb_agg(id order by id), '[]'::jsonb) from sessions)
  )
)::text;
