import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const githubSessions = pgTable("github_sessions", {
	id: text().primaryKey(),
	accessTokenEncrypted: text("access_token_encrypted").notNull(),
	accessTokenIv: text("access_token_iv").notNull(),
	accessTokenTag: text("access_token_tag").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const githubIntegrations = pgTable("github_integrations", {
	id: text().primaryKey(),
	clientId: text("client_id").notNull(),
	clientSecret: text("client_secret").notNull(),
	appName: text("app_name").notNull().default("Dequel"),
	webhookSecret: text("webhook_secret"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
	id: text().primaryKey(),
	username: text().notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	blacklistedAt: timestamp("blacklisted_at", { withTimezone: true }),
});

export const apiKeys = pgTable("api_keys", {
	id: text().primaryKey(),
	name: text().notNull(),
	keyHash: text("key_hash").notNull(),
	permissions: text().notNull().default("deploy:read"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
