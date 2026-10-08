import { foreignKey, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { deployments } from "./deployments";

export const diagRuns = pgTable(
	"diag_runs",
	{
		id: text().primaryKey(),
		deploymentId: text("deployment_id").notNull(),
		commitSha: text("commit_sha").notNull().default(""),
		provider: text().notNull(),
		model: text().notNull(),
		status: text().notNull().default("running"),
		currentStage: text("current_stage"),
		cause: text(),
		report: jsonb(),
		error: text(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({ columns: [table.deploymentId], foreignColumns: [deployments.id], onDelete: "cascade" }),
		uniqueIndex("diag_runs_deployment_commit").on(table.deploymentId, table.commitSha),
	],
);

export const diagStages = pgTable(
	"diag_stages",
	{
		id: text().primaryKey(),
		runId: text("run_id").notNull(),
		stage: text().notNull(),
		payload: jsonb(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({ columns: [table.runId], foreignColumns: [diagRuns.id], onDelete: "cascade" }),
		uniqueIndex("diag_stages_run_stage").on(table.runId, table.stage),
	],
);

export const diagActions = pgTable(
	"diag_actions",
	{
		key: text().primaryKey(),
		runId: text("run_id").notNull(),
		kind: text().notNull(),
		status: text().notNull().default("requested"),
		result: jsonb(),
		error: text(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [foreignKey({ columns: [table.runId], foreignColumns: [diagRuns.id], onDelete: "cascade" })],
);
