CREATE TABLE "deployment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"deployment_id" text NOT NULL,
	"type" text NOT NULL,
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_events" ADD CONSTRAINT "deployment_events_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_events_dep_type" ON "deployment_events" USING btree ("deployment_id","type");