import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const notificationChannels = pgTable("notification_channels", {
	id: text().primaryKey(),
	name: text().notNull(),
	channel: text().notNull(),
	destination: text(),
	enabled: boolean().notNull().default(true),
	events: jsonb("events").notNull().default([]),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
