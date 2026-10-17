CREATE TABLE "restore_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"backup_id" text NOT NULL,
	"target_id" text NOT NULL,
	"server_id" text,
	"kind" text DEFAULT 'test' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_restore_tests_backup" ON "restore_tests" USING btree ("backup_id");
--> statement-breakpoint
CREATE INDEX "idx_restore_tests_target" ON "restore_tests" USING btree ("target_id");
--> statement-breakpoint
CREATE INDEX "idx_restore_tests_status" ON "restore_tests" USING btree ("status");
