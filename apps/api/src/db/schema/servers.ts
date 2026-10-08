import { foreignKey, index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { deployments } from "./deployments";

export const servers = pgTable("servers", {
	id: text().primaryKey(),
	name: text().notNull(),
	host: text().notNull(),
	port: integer().notNull().default(2375),
	authToken: text("auth_token").notNull().default(""),
	sshUser: text("ssh_user"),
	sshKey: text("ssh_key"),
	sshKeyIv: text("ssh_key_iv"),
	sshKeyTag: text("ssh_key_tag"),
	sshPassword: text("ssh_password"),
	sshKeyId: text("ssh_key_id"),
	mode: text().notNull().default("ssh"),
	agentId: text("agent_id").unique(),
	agentVersion: text("agent_version"),
	peerIp: text("peer_ip"),
	capabilities: jsonb().notNull().default({}),
	labels: jsonb().notNull().default({}),
	status: text().notNull().default("pending"),
	cpuTotal: integer("cpu_total"),
	memoryTotalMb: integer("memory_total_mb"),
	diskTotalMb: integer("disk_total_mb"),
	cpuUsedPercent: real("cpu_used_percent"),
	memoryUsedMb: integer("memory_used_mb"),
	lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
	registeredAt: timestamp("registered_at", { withTimezone: true }),
	revokedAt: timestamp("revoked_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentRegistrationTokens = pgTable("agent_registration_tokens", {
	id: text().primaryKey(),
	tokenHash: text("token_hash").notNull().unique(),
	serverName: text("server_name").notNull(),
	labels: jsonb().notNull().default({}),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentCredentials = pgTable(
	"agent_credentials",
	{
		id: text().primaryKey(),
		serverId: text("server_id").notNull(),
		credentialHash: text("credential_hash").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
	(table) => [foreignKey({ columns: [table.serverId], foreignColumns: [servers.id], onDelete: "cascade" })],
);

export const agentJobs = pgTable(
	"agent_jobs",
	{
		id: text().primaryKey(),
		deploymentId: text("deployment_id"),
		serverId: text("server_id").notNull(),
		type: text().notNull(),
		payload: jsonb().notNull(),
		status: text().notNull().default("queued"),
		attempts: integer().notNull().default(0),
		leaseId: text("lease_id"),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		idempotencyKey: text("idempotency_key").notNull().unique(),
		failureReason: text("failure_reason"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		startedAt: timestamp("started_at", { withTimezone: true }),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
	},
	(table) => [
		foreignKey({ columns: [table.serverId], foreignColumns: [servers.id], onDelete: "cascade" }),
		foreignKey({ columns: [table.deploymentId], foreignColumns: [deployments.id], onDelete: "cascade" }),
		index("idx_agent_jobs_server_status").on(table.serverId, table.status),
	],
);

export const sshKeys = pgTable("ssh_keys", {
	id: text().primaryKey(),
	name: text().notNull(),
	fingerprint: text().notNull().unique(),
	privateKeyEncrypted: text("private_key_encrypted").notNull(),
	privateKeyIv: text("private_key_iv").notNull(),
	privateKeyTag: text("private_key_tag").notNull(),
	publicKey: text("public_key"),
	tags: jsonb().notNull().default([]),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
