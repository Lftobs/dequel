import { existsSync, readdirSync } from "node:fs";
import { migrate as drizzleMigrate } from "drizzle-orm/bun-sqlite/migrator";
import { getDrizzle } from "./drizzle";
import { sql } from "drizzle-orm";
import { config } from "../utils/config";
import { getSmtpSettings, upsertSmtpSettings } from "./repo/settings";
import { getGithubIntegration, setGithubIntegration } from "./repo/github";

export const migrate = async () => {
  const db = await getDrizzle();
  const migrationsFolder = import.meta.dirname + "/migrations";
  const journalPath = migrationsFolder + "/meta/_journal.json";

  if (!existsSync(journalPath)) {
    throw new Error(
      `Migration journal not found at ${journalPath}. ` +
      "Ensure migration files are present. " +
      "If running from a pre-built image, verify the build includes src/db/migrations/."
    );
  }

  const files = readdirSync(migrationsFolder).filter(f => f.endsWith(".sql"));
  if (files.length === 0) {
    throw new Error(
      `No migration SQL files found in ${migrationsFolder}. ` +
      "The database schema cannot be initialized."
    );
  }

  drizzleMigrate(db, { migrationsFolder });

  await addClearCacheColumn(db);
  await addFinishedAtColumn(db);
  await addInstallCommandColumn(db);
  await addOutputDirColumn(db);
  await seedFromConfig();
};

const addOutputDirColumn = async (db: ReturnType<typeof getDrizzle>) => {
  try {
    db.run(sql`ALTER TABLE projects ADD COLUMN output_dir text`);
    console.log("[Migrate] Added output_dir column to projects table");
  } catch (err) {
    const cause = err instanceof Error && "cause" in err ? err.cause : err;
    if (cause instanceof Error && cause.message.includes("duplicate column name")) return;
    console.error("[Migrate] Failed to add output_dir column:", err);
    throw err;
  }
};

const addInstallCommandColumn = async (db: ReturnType<typeof getDrizzle>) => {
  try {
    db.run(sql`ALTER TABLE projects ADD COLUMN install_command text`);
    console.log("[Migrate] Added install_command column to projects table");
  } catch (err) {
    const cause = err instanceof Error && "cause" in err ? err.cause : err;
    if (cause instanceof Error && cause.message.includes("duplicate column name")) return;
    console.error("[Migrate] Failed to add install_command column:", err);
    throw err;
  }
};

const addClearCacheColumn = async (db: ReturnType<typeof getDrizzle>) => {
  try {
    db.run(sql`ALTER TABLE deployments ADD COLUMN clear_cache integer NOT NULL DEFAULT 0`);
    console.log("[Migrate] Added clear_cache column to deployments table");
  } catch (err) {
    const cause = err instanceof Error && "cause" in err ? err.cause : err;
    if (cause instanceof Error && cause.message.includes("duplicate column name")) return;
    console.error("[Migrate] Failed to add clear_cache column:", err);
    throw err;
  }
};

const addFinishedAtColumn = async (db: ReturnType<typeof getDrizzle>) => {
  try {
    db.run(sql`ALTER TABLE deployments ADD COLUMN finished_at text`);
    console.log("[Migrate] Added finished_at column to deployments table");
  } catch (err) {
    const cause = err instanceof Error && "cause" in err ? err.cause : err;
    if (cause instanceof Error && cause.message.includes("duplicate column name")) return;
    console.error("[Migrate] Failed to add finished_at column:", err);
    throw err;
  }
};

const seedFromConfig = async () => {
  if (config.githubClientId && config.githubClientSecret) {
    const existing = await getGithubIntegration();
    if (existing) {
      if (
        existing.clientId !== config.githubClientId ||
        existing.clientSecret !== config.githubClientSecret ||
        (config.githubWebhookSecret && existing.webhookSecret !== config.githubWebhookSecret)
      ) {
        await setGithubIntegration({
          clientId: config.githubClientId,
          clientSecret: config.githubClientSecret,
          appName: config.githubAppName,
          webhookSecret: config.githubWebhookSecret || undefined,
        });
        console.log("[Config] Synced GitHub integration from config file");
      }
    } else {
      await setGithubIntegration({
        clientId: config.githubClientId,
        clientSecret: config.githubClientSecret,
        appName: config.githubAppName,
        webhookSecret: config.githubWebhookSecret || undefined,
      });
      console.log("[Config] Seeded GitHub integration from config file");
    }
  }
  if (config.smtpHost) {
    const existing = await getSmtpSettings();
    if (!existing) {
      await upsertSmtpSettings({
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser,
        pass: config.smtpPass,
        fromAddress: config.smtpFrom,
      });
      console.log("[Config] Seeded SMTP settings from config file");
    }
  }
};
