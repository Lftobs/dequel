import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || `${homedir()}/.config`;

export interface FileConfig {
  port?: number;
  databasePath?: string;
  workspaceRoot?: string;
  caddyRoutesDir?: string;
  caddyBaseDomain?: string;
  dockerNetwork?: string;
  appInternalPort?: number;
  buildkitHost?: string;
  envEncryptionKey?: string;
  redisUrl?: string;
  queueConcurrency?: number;
  queueRetryMax?: number;
  queueRetryBaseMs?: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  alertEvalIntervalMs?: number;
  githubClientId?: string;
  githubClientSecret?: string;
  githubAppName?: string;
  githubWebhookSecret?: string;
}

const searchPaths = (): string[] => {
  const explicit = process.env.DEQUEL_CONFIG;
  if (explicit) return [resolve(explicit)];
  return [
    resolve(`${XDG_CONFIG_HOME}/dequel/dequel.json`),
    resolve("./dequel.json"),
    resolve("./data/dequel.json"),
  ];
};

export const loadFileConfig = (): FileConfig => {
  for (const path of searchPaths()) {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw) as FileConfig;
        console.log(`[Config] Loaded config from ${path}`);
        return parsed;
      } catch (err) {
        console.warn(`[Config] Failed to parse ${path}:`, err);
      }
    }
  }
  return {};
};
