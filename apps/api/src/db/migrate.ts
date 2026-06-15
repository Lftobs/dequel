import { existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { migrate as drizzleMigrate } from "drizzle-orm/bun-sqlite/migrator";
import { getDrizzle } from "./drizzle";
import { getDb } from "./client";
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

  // Apply schema additions that Drizzle Kit migrations may miss
  const sqlite = await getDb();
  const tableInfo = sqlite.query("PRAGMA table_info('projects')").all() as { name: string }[];
  const columns = tableInfo.map(r => r.name);
  if (!columns.includes('port')) {
    sqlite.exec("ALTER TABLE projects ADD COLUMN port integer");
    console.log("[Migrate] Added projects.port column");
  }
  if (!columns.includes('source_dir')) {
    sqlite.exec("ALTER TABLE projects ADD COLUMN source_dir text");
    console.log("[Migrate] Added projects.source_dir column");
  }
  if (!columns.includes('source_type')) {
    sqlite.exec("ALTER TABLE projects ADD COLUMN source_type text NOT NULL DEFAULT 'git'");
    console.log("[Migrate] Added projects.source_type column");
  }

  await seedFromConfig();
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
