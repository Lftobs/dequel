import { eq } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { scalingPolicies } from "../schema";
import type { ScalingPolicy, CreateScalingPolicyInput } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapScalingPolicy = (row: typeof scalingPolicies.$inferSelect): ScalingPolicy => ({
  id: row.id,
  projectId: row.projectId,
  minReplicas: row.minReplicas,
  maxReplicas: row.maxReplicas,
  cpuThresholdPercent: row.cpuThresholdPercent,
  memoryThresholdPercent: row.memoryThresholdPercent,
  cooldownSeconds: row.cooldownSeconds,
  enabled: row.enabled === 1,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const upsertScalingPolicy = async (input: CreateScalingPolicyInput): Promise<ScalingPolicy> => {
  const db = await getDrizzle();
  const existing = db.select().from(scalingPolicies).where(eq(scalingPolicies.projectId, input.projectId)).get();
  const timestamp = now();
  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: timestamp };
    if (input.minReplicas !== undefined) updates.minReplicas = input.minReplicas;
    if (input.maxReplicas !== undefined) updates.maxReplicas = input.maxReplicas;
    if (input.cpuThresholdPercent !== undefined) updates.cpuThresholdPercent = input.cpuThresholdPercent;
    if (input.memoryThresholdPercent !== undefined) updates.memoryThresholdPercent = input.memoryThresholdPercent;
    db.update(scalingPolicies).set(updates).where(eq(scalingPolicies.projectId, input.projectId)).run();
    return mapScalingPolicy(db.select().from(scalingPolicies).where(eq(scalingPolicies.projectId, input.projectId)).get()!);
  }
  const id = randomUUID();
  db.insert(scalingPolicies).values({
    id,
    projectId: input.projectId,
    minReplicas: input.minReplicas ?? 1,
    maxReplicas: input.maxReplicas ?? 5,
    cpuThresholdPercent: input.cpuThresholdPercent ?? 70,
    memoryThresholdPercent: input.memoryThresholdPercent ?? 85,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  return mapScalingPolicy(db.select().from(scalingPolicies).where(eq(scalingPolicies.id, id)).get()!);
};

export const getScalingPolicy = async (projectId: string): Promise<ScalingPolicy | null> => {
  const db = await getDrizzle();
  const row = db.select().from(scalingPolicies).where(eq(scalingPolicies.projectId, projectId)).get();
  return row ? mapScalingPolicy(row) : null;
};

export const deleteScalingPolicy = async (projectId: string): Promise<boolean> => {
  const db = await getDrizzle();
  return db.delete(scalingPolicies).where(eq(scalingPolicies.projectId, projectId)).run().changes > 0;
};
