DROP INDEX `idx_routes_hostname`;
CREATE UNIQUE INDEX `idx_routes_hostname_server` ON `routes` (`hostname`, `server_id`);