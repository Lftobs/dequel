CREATE TABLE llm_provider_keys (
  provider text PRIMARY KEY,
  key_encrypted text,
  key_iv text,
  key_tag text,
  base_url text,
  models jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE diag_runs (
  id text PRIMARY KEY,
  deployment_id text NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  commit_sha text NOT NULL DEFAULT '',
  provider text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  current_stage text,
  cause text,
  report jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deployment_id, commit_sha)
);

CREATE TABLE diag_stages (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES diag_runs(id) ON DELETE CASCADE,
  stage text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, stage)
);

CREATE TABLE diag_actions (
  key text PRIMARY KEY,
  run_id text NOT NULL REFERENCES diag_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX diag_actions_one_done_per_kind ON diag_actions (run_id, kind) WHERE status = 'done';
