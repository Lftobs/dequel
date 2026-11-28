ALTER TABLE "environment_variables" ADD COLUMN "scope" text NOT NULL DEFAULT 'both';--> statement-breakpoint
ALTER TABLE "shared_env_vars" ADD COLUMN "scope" text NOT NULL DEFAULT 'both';
