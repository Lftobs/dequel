import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const restoreTests = pgTable(
	"restore_tests",
	{
		id: text().primaryKey(),
		backupId: text("backup_id").notNull(),
		targetId: text("target_id").notNull(),
		serverId: text("server_id"),
		kind: text().notNull().default("test"),
		status: text().notNull().default("running"),
		error: text(),
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_restore_tests_backup").on(table.backupId),
		index("idx_restore_tests_target").on(table.targetId),
		index("idx_restore_tests_status").on(table.status),
	],
);

export type RestoreTest = typeof restoreTests.$inferSelect;
