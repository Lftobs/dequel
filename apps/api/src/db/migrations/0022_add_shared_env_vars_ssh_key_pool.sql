-- New tables for shared env vars, SSH key pool
CREATE TABLE IF NOT EXISTS "shared_env_vars" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "value_encrypted" text,
  "value_iv" text,
  "value_tag" text,
  "environment" text NOT NULL DEFAULT 'production',
  "description" text,
  "tags" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "project_shared_env_links" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "shared_env_var_id" text NOT NULL REFERENCES "shared_env_vars"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_proj_shared_var" ON "project_shared_env_links" ("project_id", "shared_env_var_id");

CREATE TABLE IF NOT EXISTS "ssh_keys" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "fingerprint" text NOT NULL UNIQUE,
  "private_key_encrypted" text NOT NULL,
  "private_key_iv" text NOT NULL,
  "private_key_tag" text NOT NULL,
  "public_key" text,
  "tags" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Add sshKeyId to servers
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "ssh_key_id" text;
