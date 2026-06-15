import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { deployments, deploymentLogs } from "../schema";
import type { Deployment, DeploymentLog, CreateDeploymentInput, DeploymentStatus, LogEvent } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapDeployment = (row: typeof deployments.$inferSelect): Deployment => ({
  id: row.id,
  projectId: row.projectId,
  sourceType: row.sourceType as Deployment["sourceType"],
  sourceRef: row.sourceRef,
  status: row.status as DeploymentStatus,
  imageTag: row.imageTag,
  containerName: row.containerName,
  routePath: row.routePath,
  liveUrl: row.liveUrl,
  branch: row.branch,
  commitSha: row.commitSha,
  replicas: row.replicas,
  environment: row.environment,
  failureReason: row.failureReason,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createDeployment = async (input: CreateDeploymentInput): Promise<Deployment> => {
  const id = randomUUID();
  const timestamp = now();
  const db = await getDrizzle();
  db.insert(deployments).values({
    id,
    projectId: input.projectId ?? null,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef,
    status: "pending",
    routePath: `/apps/${id}`,
    branch: input.branch ?? null,
    commitSha: input.commitSha ?? null,
    environment: input.environment ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  const row = db.select().from(deployments).where(eq(deployments.id, id)).get()!;
  return mapDeployment(row);
};

export const listDeployments = async (projectId?: string, offset = 0, limit = 50): Promise<Deployment[]> => {
  const db = await getDrizzle();
  const rows = projectId
    ? db.select().from(deployments).where(eq(deployments.projectId, projectId)).orderBy(desc(deployments.createdAt)).limit(limit).offset(offset).all()
    : db.select().from(deployments).orderBy(desc(deployments.createdAt)).limit(limit).offset(offset).all();
  return rows.map(mapDeployment);
};

export const countDeployments = async (projectId?: string): Promise<number> => {
  const db = await getDrizzle();
  const rows = projectId
    ? db.select().from(deployments).where(eq(deployments.projectId, projectId)).all()
    : db.select().from(deployments).all();
  return rows.length;
};

export const getDeploymentById = async (id: string): Promise<Deployment | null> => {
  const db = await getDrizzle();
  const row = db.select().from(deployments).where(eq(deployments.id, id)).get();
  return row ? mapDeployment(row) : null;
};

export const updateDeploymentCommitSha = async (id: string, commitSha: string) => {
  const db = await getDrizzle();
  db.update(deployments).set({ commitSha, updatedAt: now() }).where(eq(deployments.id, id)).run();
};

export const updateDeploymentStatus = async (
  id: string,
  status: DeploymentStatus,
  patch: Partial<Pick<Deployment, "imageTag" | "containerName" | "liveUrl" | "failureReason" | "replicas">> = {},
) => {
  const db = await getDrizzle();
  const updates: Record<string, unknown> = { status, updatedAt: now() };
  if (patch.imageTag !== undefined) updates.imageTag = patch.imageTag;
  if (patch.containerName !== undefined) updates.containerName = patch.containerName;
  if (patch.liveUrl !== undefined) updates.liveUrl = patch.liveUrl;
  if (patch.failureReason !== undefined) updates.failureReason = patch.failureReason;
  if (patch.replicas !== undefined) updates.replicas = patch.replicas;
  db.update(deployments).set(updates).where(eq(deployments.id, id)).run();
};

export const deleteDeploymentAndLogs = async (id: string): Promise<boolean> => {
  const db = await getDrizzle();
  db.delete(deploymentLogs).where(eq(deploymentLogs.deploymentId, id)).run();
  const result = db.delete(deployments).where(eq(deployments.id, id)).run();
  return result.changes > 0;
};

export const appendLog = async (
  deploymentId: string,
  stage: LogEvent["stage"],
  message: string,
): Promise<DeploymentLog> => {
  const db = await getDrizzle();
  const row = db.select({ maxSeq: deploymentLogs.sequence }).from(deploymentLogs)
    .where(eq(deploymentLogs.deploymentId, deploymentId))
    .orderBy(desc(deploymentLogs.sequence)).limit(1).get();
  const sequence = (row?.maxSeq ?? 0) + 1;
  const createdAt = now();
  const result = db.insert(deploymentLogs).values({
    deploymentId,
    sequence,
    stage,
    message,
    createdAt,
  }).run();
  return {
    id: Number(result.lastInsertRowid),
    deploymentId,
    sequence,
    stage: stage as DeploymentLog["stage"],
    message,
    createdAt,
  };
};

export const getLogs = async (deploymentId: string): Promise<DeploymentLog[]> => {
  const db = await getDrizzle();
  const rows = db.select().from(deploymentLogs)
    .where(eq(deploymentLogs.deploymentId, deploymentId))
    .orderBy(deploymentLogs.sequence).all();
  return rows.map((r) => ({
    id: r.id,
    deploymentId: r.deploymentId,
    sequence: r.sequence,
    stage: r.stage as DeploymentLog["stage"],
    message: r.message,
    createdAt: r.createdAt,
  }));
};
