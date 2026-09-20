CREATE TABLE "agent_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"credential_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agent_credentials_credential_hash_unique" UNIQUE("credential_hash")
);
--> statement-breakpoint
CREATE TABLE "agent_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"deployment_id" text,
	"server_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_id" text,
	"lease_expires_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "agent_jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "agent_registration_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"server_name" text NOT NULL,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_registration_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"threshold" real,
	"duration_seconds" integer,
	"channel" text DEFAULT 'email' NOT NULL,
	"destination" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"permissions" text DEFAULT 'deploy:read' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "databases" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"version" text,
	"database_name" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"internal_host" text NOT NULL,
	"internal_port" integer NOT NULL,
	"cpu_limit" real,
	"memory_limit_mb" integer,
	"storage_limit_mb" integer,
	"storage_used_mb" integer DEFAULT 0 NOT NULL,
	"public_access" boolean DEFAULT true NOT NULL,
	"allow_public_access_from_anywhere" boolean DEFAULT false NOT NULL,
	"allowed_cidrs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"external_port" integer,
	"proxy_container_name" text,
	"volume_name" text NOT NULL,
	"connection_string" text NOT NULL,
	"status" text DEFAULT 'provisioning' NOT NULL,
	"container_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"deployment_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"stage" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"server_id" text,
	"source_type" text NOT NULL,
	"source_ref" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"image_tag" text,
	"container_name" text,
	"route_path" text,
	"live_url" text,
	"branch" text,
	"commit_sha" text,
	"replicas" integer DEFAULT 1 NOT NULL,
	"environment" text,
	"failure_reason" text,
	"clear_cache" boolean DEFAULT false NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"domain" text NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"ssl_status" text DEFAULT 'pending' NOT NULL,
	"target_service" text,
	"target_port" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_variables" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"value_encrypted" text,
	"value_iv" text,
	"value_tag" text,
	"environment" text DEFAULT 'production' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"app_name" text DEFAULT 'Dequel' NOT NULL,
	"webhook_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"ingress_server_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text,
	"name" text NOT NULL,
	"description" text,
	"repo_url" text,
	"repo_branch" text,
	"base_domain" text,
	"cpu_limit" real,
	"memory_limit_mb" integer,
	"port" integer,
	"source_dir" text,
	"source_type" text DEFAULT 'git' NOT NULL,
	"project_type" text DEFAULT 'web' NOT NULL,
	"build_type" text DEFAULT 'railpack' NOT NULL,
	"compose_service" text,
	"compose_port" integer,
	"compose_services" jsonb,
	"build_command" text,
	"install_command" text,
	"output_dir" text,
	"start_command" text,
	"github_token_encrypted" text,
	"github_token_iv" text,
	"github_token_tag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blacklisted_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text,
	"deployment_id" text,
	"project_id" text,
	"hostname" text NOT NULL,
	"route_file" text NOT NULL,
	"port" integer NOT NULL,
	"target_containers" jsonb NOT NULL,
	"upstream_host" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scaling_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"min_replicas" integer DEFAULT 1 NOT NULL,
	"max_replicas" integer DEFAULT 5 NOT NULL,
	"cpu_threshold_percent" integer DEFAULT 70 NOT NULL,
	"memory_threshold_percent" integer DEFAULT 85 NOT NULL,
	"cooldown_seconds" integer DEFAULT 120 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scaling_policies_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 2375 NOT NULL,
	"auth_token" text DEFAULT '' NOT NULL,
	"ssh_user" text,
	"mode" text DEFAULT 'ssh' NOT NULL,
	"agent_id" text,
	"agent_version" text,
	"peer_ip" text,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"cpu_total" integer,
	"memory_total_mb" integer,
	"disk_total_mb" integer,
	"cpu_used_percent" real,
	"memory_used_mb" integer,
	"last_heartbeat" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "smtp_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 587 NOT NULL,
	"user" text DEFAULT '' NOT NULL,
	"pass_encrypted" text,
	"pass_iv" text,
	"pass_tag" text,
	"from_address" text DEFAULT 'dequel@localhost' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volumes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"mount_path" text DEFAULT '/app/data' NOT NULL,
	"size_mb" integer,
	"docker_volume_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_credentials" ADD CONSTRAINT "agent_credentials_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_logs" ADD CONSTRAINT "deployment_logs_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scaling_policies" ADD CONSTRAINT "scaling_policies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_jobs_server_status" ON "agent_jobs" USING btree ("server_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_logs_dep_seq" ON "deployment_logs" USING btree ("deployment_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_env_vars_project" ON "environment_variables" USING btree ("project_id","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_routes_hostname_server" ON "routes" USING btree ("hostname","server_id");