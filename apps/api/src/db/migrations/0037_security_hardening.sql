CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor" ON "audit_logs" ("actor_type", "actor_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" ("created_at");

ALTER TABLE "databases" ADD COLUMN IF NOT EXISTS "password_encrypted" text;
ALTER TABLE "databases" ADD COLUMN IF NOT EXISTS "password_iv" text;
ALTER TABLE "databases" ADD COLUMN IF NOT EXISTS "password_tag" text;
ALTER TABLE "databases" ALTER COLUMN "password" DROP NOT NULL;

ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "is_encrypted" boolean DEFAULT false NOT NULL;

ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "cloudflare_proxied" boolean DEFAULT false NOT NULL;
