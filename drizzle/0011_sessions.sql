CREATE TABLE sessions (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  user_id text NOT NULL,
  user_display_name text NOT NULL,
  user_email text,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX sessions_cleanup_order_idx ON sessions (expires_at, id);
