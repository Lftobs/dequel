import { boolean, foreignKey, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const alerts = pgTable(
	"alerts",
	{
		id: text().primaryKey(),
		projectId: text("project_id").notNull(),
		type: text().notNull(),
		threshold: real(),
		durationSeconds: integer("duration_seconds"),
		channel: text().notNull().default("email"),
		destination: text(),
		enabled: boolean().notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" })],
);

export const smtpSettings = pgTable("smtp_settings", {
	id: text().primaryKey(),
	host: text().notNull(),
	port: integer().notNull().default(587),
	user: text().notNull().default(""),
	passEncrypted: text("pass_encrypted"),
	passIv: text("pass_iv"),
	passTag: text("pass_tag"),
	fromAddress: text("from_address").notNull().default("dequel@localhost"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettings = pgTable("platform_settings", {
	id: text().primaryKey(),
	ingressServerId: text("ingress_server_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const llmProviderKeys = pgTable("llm_provider_keys", {
	provider: text().primaryKey(),
	keyEncrypted: text("key_encrypted"),
	keyIv: text("key_iv"),
	keyTag: text("key_tag"),
	baseUrl: text("base_url"),
	models: jsonb().notNull().default([]),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
