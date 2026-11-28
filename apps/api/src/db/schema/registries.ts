import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const registries = pgTable("registries", {
	id: text().primaryKey(),
	name: text().notNull(),
	serverId: text("server_id"),
	url: text().notNull(),
	username: text().notNull(),
	passwordEncrypted: text("password_encrypted"),
	passwordIv: text("password_iv"),
	passwordTag: text("password_tag"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
