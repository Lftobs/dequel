import { eq, desc } from "drizzle-orm";
import { getDb } from "../db-provider";
import { aiSettings, aiDiagnoses } from "../schema";
import { encryptValue, decryptValue } from "../../utils/crypto";
import { config } from "../../utils/config";
import { randomUUID } from "node:crypto";

export type AiProviderType = "openai" | "gemini" | "grok" | "claude";

export interface AiSettingsData {
  defaultProvider: AiProviderType;
  openaiApiKey?: string;
  openaiModel: string;
  geminiApiKey?: string;
  geminiModel: string;
  grokApiKey?: string;
  grokModel: string;
  claudeApiKey?: string;
  claudeModel: string;
}

export interface AiSettingsPublic {
  defaultProvider: AiProviderType;
  openaiConfigured: boolean;
  openaiModel: string;
  geminiConfigured: boolean;
  geminiModel: string;
  grokConfigured: boolean;
  grokModel: string;
  claudeConfigured: boolean;
  claudeModel: string;
}

export interface AiDiagnosisRecord {
  id: string;
  deploymentId: string;
  provider: AiProviderType;
  model: string;
  summary: string;
  rootCause: string;
  explanation: string;
  suggestedFixes: Array<{
    title: string;
    description: string;
    actionType?: "command" | "code" | "config" | "env";
    snippet?: string;
  }>;
  rawResponse?: string | null;
  createdAt: Date;
}

const SETTINGS_ID = "default";

const decryptOptional = (encrypted: string | null, iv: string | null, tag: string | null): string | undefined => {
  if (!encrypted || !iv || !tag) return undefined;
  try {
    return decryptValue(encrypted, iv, tag, config.envEncryptionKey);
  } catch {
    return undefined;
  }
};

export const getAiSettings = async (): Promise<AiSettingsData> => {
  try {
    const db = getDb();
    if (!db || typeof db.select !== "function") throw new Error("DB not ready");
    const rows = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.id, SETTINGS_ID))
      .limit(1);

    if (rows.length === 0) {
      return {
        defaultProvider: "openai",
        openaiModel: "gpt-4o-mini",
        geminiModel: "gemini-2.0-flash",
        grokModel: "grok-2-latest",
        claudeModel: "claude-3-5-sonnet-20241022",
      };
    }

    const row = rows[0];
    return {
      defaultProvider: (row.defaultProvider as AiProviderType) || "openai",
      openaiApiKey: decryptOptional(row.openaiApiKeyEncrypted, row.openaiApiKeyIv, row.openaiApiKeyTag),
      openaiModel: row.openaiModel || "gpt-4o-mini",
      geminiApiKey: decryptOptional(row.geminiApiKeyEncrypted, row.geminiApiKeyIv, row.geminiApiKeyTag),
      geminiModel: row.geminiModel || "gemini-2.0-flash",
      grokApiKey: decryptOptional(row.grokApiKeyEncrypted, row.grokApiKeyIv, row.grokApiKeyTag),
      grokModel: row.grokModel || "grok-2-latest",
      claudeApiKey: decryptOptional(row.claudeApiKeyEncrypted, row.claudeApiKeyIv, row.claudeApiKeyTag),
      claudeModel: row.claudeModel || "claude-3-5-sonnet-20241022",
    };
  } catch {
    return {
      defaultProvider: "openai",
      openaiModel: "gpt-4o-mini",
      geminiModel: "gemini-2.0-flash",
      grokModel: "grok-2-latest",
      claudeModel: "claude-3-5-sonnet-20241022",
    };
  }
};

export const getPublicAiSettings = async (): Promise<AiSettingsPublic> => {
  const settings = await getAiSettings();
  return {
    defaultProvider: settings.defaultProvider,
    openaiConfigured: Boolean(settings.openaiApiKey || process.env.OPENAI_API_KEY),
    openaiModel: settings.openaiModel,
    geminiConfigured: Boolean(settings.geminiApiKey || process.env.GEMINI_API_KEY),
    geminiModel: settings.geminiModel,
    grokConfigured: Boolean(settings.grokApiKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY),
    grokModel: settings.grokModel,
    claudeConfigured: Boolean(settings.claudeApiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
    claudeModel: settings.claudeModel,
  };
};

export const upsertAiSettings = async (input: Partial<AiSettingsData>): Promise<void> => {
  const db = getDb();
  const existingRows = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, SETTINGS_ID))
    .limit(1);

  const existing = existingRows[0];

  const openaiEnc = input.openaiApiKey !== undefined
    ? (input.openaiApiKey ? encryptValue(input.openaiApiKey, config.envEncryptionKey) : null)
    : undefined;
  const geminiEnc = input.geminiApiKey !== undefined
    ? (input.geminiApiKey ? encryptValue(input.geminiApiKey, config.envEncryptionKey) : null)
    : undefined;
  const grokEnc = input.grokApiKey !== undefined
    ? (input.grokApiKey ? encryptValue(input.grokApiKey, config.envEncryptionKey) : null)
    : undefined;
  const claudeEnc = input.claudeApiKey !== undefined
    ? (input.claudeApiKey ? encryptValue(input.claudeApiKey, config.envEncryptionKey) : null)
    : undefined;

  const valuesToSave = {
    defaultProvider: input.defaultProvider ?? existing?.defaultProvider ?? "openai",
    openaiModel: input.openaiModel ?? existing?.openaiModel ?? "gpt-4o-mini",
    geminiModel: input.geminiModel ?? existing?.geminiModel ?? "gemini-2.0-flash",
    grokModel: input.grokModel ?? existing?.grokModel ?? "grok-2-latest",
    claudeModel: input.claudeModel ?? existing?.claudeModel ?? "claude-3-5-sonnet-20241022",
    openaiApiKeyEncrypted: openaiEnc !== undefined ? (openaiEnc?.encrypted ?? null) : (existing?.openaiApiKeyEncrypted ?? null),
    openaiApiKeyIv: openaiEnc !== undefined ? (openaiEnc?.iv ?? null) : (existing?.openaiApiKeyIv ?? null),
    openaiApiKeyTag: openaiEnc !== undefined ? (openaiEnc?.tag ?? null) : (existing?.openaiApiKeyTag ?? null),
    geminiApiKeyEncrypted: geminiEnc !== undefined ? (geminiEnc?.encrypted ?? null) : (existing?.geminiApiKeyEncrypted ?? null),
    geminiApiKeyIv: geminiEnc !== undefined ? (geminiEnc?.iv ?? null) : (existing?.geminiApiKeyIv ?? null),
    geminiApiKeyTag: geminiEnc !== undefined ? (geminiEnc?.tag ?? null) : (existing?.geminiApiKeyTag ?? null),
    grokApiKeyEncrypted: grokEnc !== undefined ? (grokEnc?.encrypted ?? null) : (existing?.grokApiKeyEncrypted ?? null),
    grokApiKeyIv: grokEnc !== undefined ? (grokEnc?.iv ?? null) : (existing?.grokApiKeyIv ?? null),
    grokApiKeyTag: grokEnc !== undefined ? (grokEnc?.tag ?? null) : (existing?.grokApiKeyTag ?? null),
    claudeApiKeyEncrypted: claudeEnc !== undefined ? (claudeEnc?.encrypted ?? null) : (existing?.claudeApiKeyEncrypted ?? null),
    claudeApiKeyIv: claudeEnc !== undefined ? (claudeEnc?.iv ?? null) : (existing?.claudeApiKeyIv ?? null),
    claudeApiKeyTag: claudeEnc !== undefined ? (claudeEnc?.tag ?? null) : (existing?.claudeApiKeyTag ?? null),
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(aiSettings)
      .set(valuesToSave)
      .where(eq(aiSettings.id, SETTINGS_ID));
  } else {
    await db.insert(aiSettings).values({
      id: SETTINGS_ID,
      ...valuesToSave,
    });
  }
};

export const saveAiDiagnosis = async (input: {
  deploymentId: string;
  provider: AiProviderType;
  model: string;
  summary: string;
  rootCause: string;
  explanation: string;
  suggestedFixes: Array<{
    title: string;
    description: string;
    actionType?: "command" | "code" | "config" | "env";
    snippet?: string;
  }>;
  rawResponse?: string | null;
}): Promise<AiDiagnosisRecord> => {
  const db = getDb();
  const id = randomUUID();
  const values = {
    id,
    deploymentId: input.deploymentId,
    provider: input.provider,
    model: input.model,
    summary: input.summary,
    rootCause: input.rootCause,
    explanation: input.explanation,
    suggestedFixes: input.suggestedFixes,
    rawResponse: input.rawResponse ?? null,
  };

  await db.insert(aiDiagnoses).values(values);

  return {
    ...values,
    createdAt: new Date(),
  };
};

export const getLatestAiDiagnosis = async (deploymentId: string): Promise<AiDiagnosisRecord | null> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(aiDiagnoses)
    .where(eq(aiDiagnoses.deploymentId, deploymentId))
    .orderBy(desc(aiDiagnoses.createdAt))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    deploymentId: row.deploymentId,
    provider: row.provider as AiProviderType,
    model: row.model,
    summary: row.summary,
    rootCause: row.rootCause,
    explanation: row.explanation,
    suggestedFixes: (row.suggestedFixes as any) || [],
    rawResponse: row.rawResponse,
    createdAt: row.createdAt,
  };
};

export const deleteAiDiagnosesByDeployment = async (deploymentId: string): Promise<void> => {
  const db = getDb();
  await db.delete(aiDiagnoses).where(eq(aiDiagnoses.deploymentId, deploymentId));
};
