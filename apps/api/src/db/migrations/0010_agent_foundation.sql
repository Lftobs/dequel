CREATE TABLE agent_registration_tokens (
  id text PRIMARY KEY NOT NULL,
  token_hash text NOT NULL UNIQUE,
  server_name text NOT NULL,
  labels text NOT NULL DEFAULT '{}',
  expires_at text NOT NULL,
  used_at text,
  created_at text NOT NULL
);
--> statement-breakpoint
CREATE TABLE agent_credentials (
  id text PRIMARY KEY NOT NULL,
  server_id text NOT NULL,
  credential_hash text NOT NULL UNIQUE,
  created_at text NOT NULL,
  last_used_at text,
  revoked_at text,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE agent_jobs (
  id text PRIMARY KEY NOT NULL,
  deployment_id text,
  server_id text NOT NULL,
  type text NOT NULL,
  payload text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  lease_id text,
  lease_expires_at text,
  idempotency_key text NOT NULL UNIQUE,
  failure_reason text,
  created_at text NOT NULL,
  started_at text,
  finished_at text,
  FOREIGN KEY (deployment_id) REFERENCES deployments(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_agent_jobs_server_status ON agent_jobs(server_id, status);
