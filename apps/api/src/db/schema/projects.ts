import { foreignKey, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
	id: text().primaryKey(),
	serverId: text("server_id"),
	name: text().notNull(),
	description: text(),
	repoUrl: text("repo_url"),
	repoBranch: text("repo_branch"),
	baseDomain: text("base_domain"),
	cpuLimit: real("cpu_limit"),
	memoryLimitMb: integer("memory_limit_mb"),
	port: integer("port"),
	sourceDir: text("source_dir"),
	sourceType: text("source_type").default("git").notNull(),
	projectType: text("project_type").default("web").notNull(),
	buildType: text("build_type").default("railpack").notNull(),
	composeService: text("compose_service"),
	composePort: integer("compose_port"),
	composeServices: jsonb("compose_services"),
	buildCommand: text("build_command"),
	installCommand: text("install_command"),
	outputDir: text("output_dir"),
	startCommand: text("start_command"),
	githubTokenEncrypted: text("github_token_encrypted"),
	githubTokenIv: text("github_token_iv"),
	githubTokenTag: text("github_token_tag"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const volumes = pgTable(
	"volumes",
	{
		id: text().primaryKey(),
		projectId: text("project_id").notNull(),
		mountPath: text("mount_path").notNull().default("/app/data"),
		sizeMb: integer("size_mb"),
		dockerVolumeName: text("docker_volume_name"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" })],
);
