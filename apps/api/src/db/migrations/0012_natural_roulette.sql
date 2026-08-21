CREATE TABLE `routes` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text,
	`deployment_id` text,
	`project_id` text,
	`hostname` text NOT NULL,
	`route_file` text NOT NULL,
	`port` integer NOT NULL,
	`target_containers` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`confirmed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_routes_hostname` ON `routes` (`hostname`);--> statement-breakpoint
ALTER TABLE `projects` ADD `output_dir` text;--> statement-breakpoint
CREATE UNIQUE INDEX `servers_agent_id_unique` ON `servers` (`agent_id`);