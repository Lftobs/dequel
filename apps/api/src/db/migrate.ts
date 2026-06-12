import { existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { migrate as drizzleMigrate } from "drizzle-orm/bun-sqlite/migrator";
import { getDrizzle } from "./drizzle";
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
  await seedFromConfig();
};

const seedFromConfig = async () => {
  if (config.githubClientId && config.githubClientSecret) {
    const existing = await getGithubIntegration();
    if (!existing) {
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
