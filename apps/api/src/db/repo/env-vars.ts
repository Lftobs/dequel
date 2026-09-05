import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../db-provider";
import { environmentVariables } from "../schema";
import type { EnvironmentVariable, CreateEnvironmentVariableInput } from "../../types";
import { randomUUID } from "node:crypto";
import { config } from "../../utils/config";
import { encryptValue, decryptValue } from "../../utils/crypto";
import { now, getRowsAffected } from "./helpers";

const mapEnvVar = (row: typeof environmentVariables.$inferSelect): EnvironmentVariable => ({
  id: row.id,
  projectId: row.projectId,
  key: row.key,
  value: row.value ?? "",
  environment: row.environment,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createEnvironmentVariable = async (input: CreateEnvironmentVariableInput): Promise<EnvironmentVariable> => {
  const id = randomUUID();
  const timestamp = now();
  const env = input.environment ?? "production";
  const encrypted = encryptValue(input.value, config.envEncryptionKey);
  const db = await getDb();
  await db.insert(environmentVariables).values({
    id,
    projectId: input.projectId,
    key: input.key,
    value: "",
    valueEncrypted: encrypted.encrypted,
    valueIv: encrypted.iv,
    valueTag: encrypted.tag,
    environment: env,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).execute();
  const [row] = await db.select().from(environmentVariables).where(eq(environmentVariables.id, id)).execute();
  return mapEnvVar(row);
};

export const listEnvironmentVariables = async (projectId: string, environment?: string): Promise<EnvironmentVariable[]> => {
  const db = await getDb();
  const cond = environment
    ? and(eq(environmentVariables.projectId, projectId), eq(environmentVariables.environment, environment))
    : eq(environmentVariables.projectId, projectId);
  const rows = await db.select().from(environmentVariables).where(cond).orderBy(asc(environmentVariables.key)).execute();
  return rows.map(mapEnvVar);
};

export const getEnvironmentVariablePlaintext = async (id: string): Promise<string | null> => {
  const db = await getDb();
  const [row] = await db.select({
    value: environmentVariables.value,
    valueEncrypted: environmentVariables.valueEncrypted,
    valueIv: environmentVariables.valueIv,
    valueTag: environmentVariables.valueTag,
  }).from(environmentVariables).where(eq(environmentVariables.id, id)).execute();
  if (!row) return null;
  if (row.valueEncrypted && row.valueIv && row.valueTag) {
    return decryptValue(row.valueEncrypted, row.valueIv, row.valueTag, config.envEncryptionKey);
  }
  return row.value ?? null;
};

export const getEnvironmentVariableById = async (id: string): Promise<EnvironmentVariable | null> => {
  const db = await getDb();
  const [row] = await db.select().from(environmentVariables).where(eq(environmentVariables.id, id)).execute();
  return row ? mapEnvVar(row) : null;
};

export const updateEnvironmentVariable = async (id: string, value: string): Promise<EnvironmentVariable | null> => {
  const existing = await getEnvironmentVariableById(id);
  if (!existing) return null;
  const encrypted = encryptValue(value, config.envEncryptionKey);
  const db = await getDb();
  await db.update(environmentVariables).set({
    value: "",
    valueEncrypted: encrypted.encrypted,
    valueIv: encrypted.iv,
    valueTag: encrypted.tag,
    updatedAt: now(),
  }).where(eq(environmentVariables.id, id)).execute();
  return getEnvironmentVariableById(id);
};

export const listEnvironmentVariablesForDeploy = async (projectId: string, environment?: string): Promise<{ key: string; value: string }[]> => {
  const db = await getDb();
  const cond = environment
    ? and(eq(environmentVariables.projectId, projectId), eq(environmentVariables.environment, environment))
    : eq(environmentVariables.projectId, projectId);
  const rows = await db.select({
    key: environmentVariables.key,
    value: environmentVariables.value,
    valueEncrypted: environmentVariables.valueEncrypted,
    valueIv: environmentVariables.valueIv,
    valueTag: environmentVariables.valueTag,
  }).from(environmentVariables).where(cond).orderBy(asc(environmentVariables.key)).execute();
  const localVars = rows.map((row) => {
    if (row.valueEncrypted && row.valueIv && row.valueTag) {
      return { key: row.key, value: decryptValue(row.valueEncrypted, row.valueIv, row.valueTag, config.envEncryptionKey) };
    }
    return { key: row.key, value: row.value ?? "" };
  });

  const { listSharedEnvVarsForDeploy } = await import("./shared-env-vars");
  const sharedVars = await listSharedEnvVarsForDeploy(projectId, environment);

  const localKeys = new Set(localVars.map((v) => v.key));
  const merged = [...sharedVars.filter((v) => !localKeys.has(v.key)), ...localVars];
  return merged;
};

export const deleteEnvironmentVariable = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return getRowsAffected(await db.delete(environmentVariables).where(eq(environmentVariables.id, id)).execute()) > 0;
};
