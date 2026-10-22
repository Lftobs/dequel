import { boolean, foreignKey, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const domains = pgTable(
	"domains",
	{
		id: text().primaryKey(),
		projectId: text("project_id").notNull(),
		domain: text().notNull(),
		type: text().notNull().default("custom"),
		validationStatus: text("validation_status").notNull().default("pending"),
		sslStatus: text("ssl_status").notNull().default("pending"),
		targetService: text("target_service"),
		targetPort: integer("target_port"),
		cloudflareProxied: boolean("cloudflare_proxied").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" })],
);

export const routes = pgTable(
	"routes",
	{
		id: text().primaryKey(),
		serverId: text("server_id"),
		deploymentId: text("deployment_id"),
		projectId: text("project_id"),
		hostname: text().notNull(),
		routeFile: text("route_file").notNull(),
		port: integer().notNull(),
		targetContainers: jsonb("target_containers").notNull(),
		upstreamHost: text("upstream_host"),
		status: text().notNull().default("pending"),
		lastError: text("last_error"),
		confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [uniqueIndex("idx_routes_hostname_server").on(table.hostname, table.serverId)],
);
