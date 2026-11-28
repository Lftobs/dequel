ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "git_provider" text DEFAULT 'github' NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "git_token_encrypted" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "git_token_iv" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "git_token_tag" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dockerfile_path" text DEFAULT 'Dockerfile';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "docker_target" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "image_ref" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "image_pull_policy" text DEFAULT 'always' NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "registry_id" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "health_check" jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "restart_policy" text DEFAULT 'unless-stopped' NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "restart_max_retries" integer;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "stop_grace_period_seconds" integer DEFAULT 10;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "pre_deploy_command" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "post_deploy_command" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "cancel_older_deployments" boolean DEFAULT false NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deploy_webhook_token" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "maintenance_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "maintenance_message" text;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_projects_webhook_token" ON "projects" ("deploy_webhook_token");

ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "tls_mode" text DEFAULT 'auto' NOT NULL;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "certificate" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "certificate_key_encrypted" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "certificate_key_iv" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "certificate_key_tag" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "basic_auth_user" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "basic_auth_password_encrypted" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "basic_auth_password_iv" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "basic_auth_password_tag" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "https_redirect" boolean DEFAULT true NOT NULL;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "gzip" boolean DEFAULT true NOT NULL;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "noindex" boolean DEFAULT false NOT NULL;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "www_redirect" boolean DEFAULT false NOT NULL;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "path_prefix" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "strip_prefix" boolean DEFAULT false NOT NULL;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "raw_snippet" text;

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "project_id" text;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "paused_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "registries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"server_id" text,
	"url" text NOT NULL,
	"username" text NOT NULL,
	"password_encrypted" text,
	"password_iv" text,
	"password_tag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"destination" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
