import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const auditLogs = pgTable(
	"audit_logs",
	{
		id: text().primaryKey(),
		actorType: text("actor_type").notNull(),
		actorId: text("actor_id").notNull(),
		action: text().notNull(),
		resourceType: text("resource_type").notNull(),
		resourceId: text("resource_id"),
		details: jsonb().notNull().default({}),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_audit_logs_actor").on(table.actorType, table.actorId),
		index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
		index("idx_audit_logs_created_at").on(table.createdAt),
	],
);
