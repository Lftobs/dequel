PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_databases` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`version` text,
	`database_name` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`internal_host` text NOT NULL,
	`internal_port` integer NOT NULL,
	`cpu_limit` real,
	`memory_limit_mb` integer,
	`storage_limit_mb` integer,
	`storage_used_mb` integer DEFAULT 0 NOT NULL,
	`public_access` integer DEFAULT 1 NOT NULL,
	`allow_public_access_from_anywhere` integer DEFAULT 0 NOT NULL,
	`allowed_cidrs` text DEFAULT '[]' NOT NULL,
	`external_port` integer,
	`proxy_container_name` text,
	`volume_name` text NOT NULL,
	`connection_string` text NOT NULL,
	`status` text DEFAULT 'provisioning' NOT NULL,
	`container_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_databases`("id", "project_id", "name", "type", "version", "database_name", "username", "password", "internal_host", "internal_port", "cpu_limit", "memory_limit_mb", "storage_limit_mb", "storage_used_mb", "public_access", "allow_public_access_from_anywhere", "allowed_cidrs", "external_port", "proxy_container_name", "volume_name", "connection_string", "status", "container_name", "created_at", "updated_at") SELECT "id", "project_id", "name", "type", "version", "database_name", "username", "password", "internal_host", "internal_port", "cpu_limit", "memory_limit_mb", "storage_limit_mb", "storage_used_mb", "public_access", "allow_public_access_from_anywhere", "allowed_cidrs", "external_port", "proxy_container_name", "volume_name", "connection_string", "status", "container_name", "created_at", "updated_at" FROM `databases`;--> statement-breakpoint
DROP TABLE `databases`;--> statement-breakpoint
ALTER TABLE `__new_databases` RENAME TO `databases`;--> statement-breakpoint
PRAGMA foreign_keys=ON;