import { eq } from "drizzle-orm";
import { getDb } from "../db-provider";
import { scalingPolicies } from "../schema";
import type { ScalingPolicy, CreateScalingPolicyInput } from "../../types";
import { randomUUID } from "node:crypto";
import { now, getRowsAffected } from "./helpers";

const mapScalingPolicy = (row: typeof scalingPolicies.$inferSelect): ScalingPolicy => ({
  id: row.id,
  projectId: row.projectId,
  minReplicas: row.minReplicas,
  maxReplicas: row.maxReplicas,
  cpuThresholdPercent: row.cpuThresholdPercent,
  memoryThresholdPercent: row.memoryThresholdPercent,
  cooldownSeconds: row.cooldownSeconds,
  enabled: row.enabled,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const upsertScalingPolicy = async (input: CreateScalingPolicyInput): Promise<ScalingPolicy> => {
  const db = await getDb();
  const existing = await db.select().from(scalingPolicies).where(eq(scalingPolicies.projectId, input.projectId)).execute();
  const timestamp = now();
  if (existing[0]) {
    const updates: Record<string, unknown> = { updatedAt: timestamp };
    if (input.minReplicas !== undefined) updates.minReplicas = input.minReplicas;
    if (input.maxReplicas !== undefined) updates.maxReplicas = input.maxReplicas;
    if (input.cpuThresholdPercent !== undefined) updates.cpuThresholdPercent = input.cpuThresholdPercent;
    if (input.memoryThresholdPercent !== undefined) updates.memoryThresholdPercent = input.memoryThresholdPercent;
    if (input.cooldownSeconds !== undefined) updates.cooldownSeconds = input.cooldownSeconds;
    if (input.enabled !== undefined) updates.enabled = input.enabled;
    await db.update(scalingPolicies).set(updates).where(eq(scalingPolicies.projectId, input.projectId)).execute();
    const [updated] = await db.select().from(scalingPolicies).where(eq(scalingPolicies.projectId, input.projectId)).execute();
    return mapScalingPolicy(updated);
  }
  const id = randomUUID();
  await db.insert(scalingPolicies).values({
    id,
    projectId: input.projectId,
    minReplicas: input.minReplicas ?? 1,
    maxReplicas: input.maxReplicas ?? 5,
    cpuThresholdPercent: input.cpuThresholdPercent ?? 70,
    memoryThresholdPercent: input.memoryThresholdPercent ?? 85,
    cooldownSeconds: input.cooldownSeconds ?? 120,
    enabled: input.enabled !== undefined ? input.enabled : true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).execute();
  const [row] = await db.select().from(scalingPolicies).where(eq(scalingPolicies.id, id)).execute();
  return mapScalingPolicy(row);
};

export const getScalingPolicy = async (projectId: string): Promise<ScalingPolicy | null> => {
  const db = await getDb();
  const [row] = await db.select().from(scalingPolicies).where(eq(scalingPolicies.projectId, projectId)).execute();
  return row ? mapScalingPolicy(row) : null;
};

export const deleteScalingPolicy = async (projectId: string): Promise<boolean> => {
  const db = await getDb();
  return getRowsAffected(await db.delete(scalingPolicies).where(eq(scalingPolicies.projectId, projectId)).execute()) > 0;
};
