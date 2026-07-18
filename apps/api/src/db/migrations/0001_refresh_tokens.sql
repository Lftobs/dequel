CREATE TABLE IF NOT EXISTS refresh_tokens (
  id text PRIMARY KEY NOT NULL,
  username text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at text NOT NULL,
  created_at text NOT NULL,
  blacklisted_at text
);
