ALTER TABLE projects ADD COLUMN server_id text;
--> statement-breakpoint
ALTER TABLE deployments ADD COLUMN server_id text;
--> statement-breakpoint
ALTER TABLE servers ADD COLUMN mode text NOT NULL DEFAULT 'docker_tcp';
--> statement-breakpoint
ALTER TABLE servers ADD COLUMN agent_id text;
--> statement-breakpoint
ALTER TABLE servers ADD COLUMN agent_version text;
--> statement-breakpoint
ALTER TABLE servers ADD COLUMN capabilities text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE servers ADD COLUMN labels text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE servers ADD COLUMN registered_at text;
--> statement-breakpoint
ALTER TABLE servers ADD COLUMN revoked_at text;
--> statement-breakpoint
INSERT INTO servers (id, name, host, port, auth_token, mode, status, capabilities, labels, registered_at, created_at, updated_at)
SELECT 'local', 'Local server', '127.0.0.1', 0, '', 'local', 'connected', '{"docker":true,"buildkit":true,"caddy":true,"compose":true}', '{}', datetime('now'), datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM servers WHERE id = 'local');
--> statement-breakpoint
UPDATE projects SET server_id = 'local' WHERE server_id IS NULL;
--> statement-breakpoint
UPDATE deployments SET server_id = COALESCE((SELECT server_id FROM projects WHERE projects.id = deployments.project_id), 'local') WHERE server_id IS NULL;
