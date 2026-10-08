import { foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const environmentVariables = pgTable(
	"environment_variables",
	{
		id: text().primaryKey(),
		projectId: text("project_id").notNull(),
		key: text().notNull(),
		value: text().notNull(),
		valueEncrypted: text("value_encrypted"),
		valueIv: text("value_iv"),
		valueTag: text("value_tag"),
		environment: text().notNull().default("production"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
		index("idx_env_vars_project").on(table.projectId, table.environment),
	],
);

export const sharedEnvVars = pgTable("shared_env_vars", {
	id: text().primaryKey(),
	key: text().notNull(),
	value: text().notNull(),
	valueEncrypted: text("value_encrypted"),
	valueIv: text("value_iv"),
	valueTag: text("value_tag"),
	environment: text().notNull().default("production"),
	description: text(),
	tags: jsonb().notNull().default([]),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectSharedEnvLinks = pgTable(
	"project_shared_env_links",
	{
		id: text().primaryKey(),
		projectId: text("project_id").notNull(),
		sharedEnvVarId: text("shared_env_var_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
		foreignKey({ columns: [table.sharedEnvVarId], foreignColumns: [sharedEnvVars.id], onDelete: "cascade" }),
		uniqueIndex("idx_proj_shared_var").on(table.projectId, table.sharedEnvVarId),
	],
);
