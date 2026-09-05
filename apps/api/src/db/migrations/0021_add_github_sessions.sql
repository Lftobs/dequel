-- GitHub sessions table with encrypted access tokens
CREATE TABLE IF NOT EXISTS github_sessions (
  id text PRIMARY KEY,
  access_token_encrypted text NOT NULL,
  access_token_iv text NOT NULL,
  access_token_tag text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
