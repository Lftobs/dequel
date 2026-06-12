CREATE TABLE IF NOT EXISTS `github_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`app_name` text NOT NULL DEFAULT 'Dequel',
	`webhook_secret` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`repo_url` text,
	`repo_branch` text,
	`base_domain` text,
	`cpu_limit` real,
	`memory_limit_mb` integer,
	`github_token_encrypted` text,
	`github_token_iv` text,
	`github_token_tag` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`source_type` text NOT NULL,
	`source_ref` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`image_tag` text,
	`container_name` text,
	`route_path` text,
	`live_url` text,
	`branch` text,
	`commit_sha` text,
	`replicas` integer NOT NULL DEFAULT 1,
	`environment` text,
	`failure_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deployment_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deployment_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`stage` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`deployment_id`) REFERENCES `deployments`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_logs_dep_seq` ON `deployment_logs` (`deployment_id`, `sequence`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `environment_variables` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`value_encrypted` text,
	`value_iv` text,
	`value_tag` text,
	`environment` text NOT NULL DEFAULT 'production',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_env_vars_project` ON `environment_variables` (`project_id`, `environment`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `volumes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`mount_path` text NOT NULL DEFAULT '/app/data',
	`size_mb` integer,
	`docker_volume_name` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `databases` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`version` text,
	`database_name` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`internal_host` text NOT NULL,
	`internal_port` integer NOT NULL,
	`cpu_limit` real,
	`memory_limit_mb` integer,
	`connection_string` text NOT NULL,
	`status` text NOT NULL DEFAULT 'provisioning',
	`container_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`domain` text NOT NULL,
	`type` text NOT NULL DEFAULT 'custom',
	`validation_status` text NOT NULL DEFAULT 'pending',
	`ssl_status` text NOT NULL DEFAULT 'pending',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scaling_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL UNIQUE,
	`min_replicas` integer NOT NULL DEFAULT 1,
	`max_replicas` integer NOT NULL DEFAULT 5,
	`cpu_threshold_percent` integer NOT NULL DEFAULT 70,
	`memory_threshold_percent` integer NOT NULL DEFAULT 85,
	`cooldown_seconds` integer NOT NULL DEFAULT 120,
	`enabled` integer NOT NULL DEFAULT 1,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL DEFAULT 2375,
	`auth_token` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'pending',
	`cpu_total` integer,
	`memory_total_mb` integer,
	`disk_total_mb` integer,
	`cpu_used_percent` real,
	`memory_used_mb` integer,
	`last_heartbeat` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`permissions` text NOT NULL DEFAULT 'deploy:read',
	`created_at` text NOT NULL,
	`last_used_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `smtp_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL DEFAULT 587,
	`user` text NOT NULL DEFAULT '',
	`pass_encrypted` text,
	`pass_iv` text,
	`pass_tag` text,
	`from_address` text NOT NULL DEFAULT 'dequel@localhost',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`threshold` real,
	`duration_seconds` integer,
	`channel` text NOT NULL DEFAULT 'email',
	`destination` text,
	`enabled` integer NOT NULL DEFAULT 1,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
