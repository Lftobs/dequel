ALTER TABLE "github_integrations" ADD COLUMN "client_secret_iv" text;--> statement-breakpoint
ALTER TABLE "github_integrations" ADD COLUMN "client_secret_tag" text;--> statement-breakpoint
ALTER TABLE "github_integrations" ADD COLUMN "webhook_secret_iv" text;--> statement-breakpoint
ALTER TABLE "github_integrations" ADD COLUMN "webhook_secret_tag" text;