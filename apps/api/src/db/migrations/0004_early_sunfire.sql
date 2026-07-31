ALTER TABLE `projects` ADD `build_type` text DEFAULT 'railpack' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `compose_service` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `compose_port` integer;