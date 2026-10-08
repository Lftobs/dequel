import {
	boolean,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const deployments = pgTable("deployments", {
	id: text().primaryKey(),
	projectId: text("project_id"),
	serverId: text("server_id"),
	sourceType: text("source_type").notNull(),
	sourceRef: text("source_ref").notNull(),
	status: text().notNull().default("pending"),
	imageTag: text("image_tag"),
	containerName: text("container_name"),
	routePath: text("route_path"),
	liveUrl: text("live_url"),
	branch: text(),
	commitSha: text("commit_sha"),
	replicas: integer().notNull().default(1),
	environment: text(),
	failureReason: text("failure_reason"),
	clearCache: boolean("clear_cache").notNull().default(false),
	finishedAt: timestamp("finished_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deploymentLogs = pgTable(
	"deployment_logs",
	{
		id: serial().primaryKey(),
		deploymentId: text("deployment_id").notNull(),
		sequence: integer().notNull(),
		stage: text().notNull(),
		message: text().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({ columns: [table.deploymentId], foreignColumns: [deployments.id], onDelete: "cascade" }),
		uniqueIndex("idx_logs_dep_seq").on(table.deploymentId, table.sequence),
	],
);

export const deploymentEvents = pgTable(
	"deployment_events",
	{
		id: text().primaryKey(),
		deploymentId: text("deployment_id").notNull(),
		type: text().notNull(),
		message: text(),
		metadata: jsonb("metadata"),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		attempts: integer().notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({ columns: [table.deploymentId], foreignColumns: [deployments.id], onDelete: "cascade" }),
		index("idx_events_dep_type").on(table.deploymentId, table.type),
	],
);

export const scalingPolicies = pgTable(
	"scaling_policies",
	{
		id: text().primaryKey(),
		projectId: text("project_id").notNull().unique(),
		minReplicas: integer("min_replicas").notNull().default(1),
		maxReplicas: integer("max_replicas").notNull().default(5),
		cpuThresholdPercent: integer("cpu_threshold_percent").notNull().default(70),
		memoryThresholdPercent: integer("memory_threshold_percent").notNull().default(85),
		cooldownSeconds: integer("cooldown_seconds").notNull().default(120),
		enabled: boolean().notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" })],
);
