import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./client";
import { config } from "../utils/config";
import { getSmtpSettings, upsertSmtpSettings } from "./repo/settings";
import { getGithubIntegration, setGithubIntegration } from "./repo/github";

export const migrate = async () => {
  const db = await getDb();
  const migrationsFolder = import.meta.dirname + "/migrations";

  try {
    await drizzleMigrate(db, { migrationsFolder });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const innerCode = err?.cause?.code;
    if (err?.code === "42P07" || innerCode === "42P07" || msg.includes("already exists")) {
      console.log("[Migrate] Some tables already exist, skipping");
    } else {
      throw err;
    }
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
