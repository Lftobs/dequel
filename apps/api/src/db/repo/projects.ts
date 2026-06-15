import { eq } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { projects, deployments, deploymentLogs, environmentVariables, volumes, databases, domains, scalingPolicies, alerts } from "../schema";
import type { Project, CreateProjectInput } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

export interface ProjectCleanupInfo {
  deploymentContainerNames: string[];
  deploymentImageTags: string[];
  databaseContainerNames: string[];
  databaseVolumeNames: string[];
  volumeDockerNames: string[];
  domains: { domain: string; projectName: string }[];
  slug: string;
  projectName: string;
}

const mapProject = (row: typeof projects.$inferSelect): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  repoUrl: row.repoUrl,
  repoBranch: row.repoBranch,
  baseDomain: row.baseDomain,
  cpuLimit: row.cpuLimit,
  memoryLimitMb: row.memoryLimitMb,
  port: row.port ?? null,
  sourceDir: row.sourceDir ?? null,
  sourceType: row.sourceType,
  githubTokenEncrypted: row.githubTokenEncrypted ?? null,
  githubTokenIv: row.githubTokenIv ?? null,
  githubTokenTag: row.githubTokenTag ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createProject = async (input: CreateProjectInput): Promise<Project> => {
  const id = randomUUID();
  const timestamp = now();
  const db = await getDrizzle();
  db.insert(projects).values({
    id,
    name: input.name,
    description: input.description ?? null,
    repoUrl: input.repoUrl ?? null,
    repoBranch: input.repoBranch ?? null,
    baseDomain: input.baseDomain ?? null,
    cpuLimit: input.cpuLimit ?? null,
    memoryLimitMb: input.memoryLimitMb ?? null,
    port: input.port ?? null,
    sourceDir: input.sourceDir ?? null,
    sourceType: input.sourceType ?? "git",
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  const row = db.select().from(projects).where(eq(projects.id, id)).get()!;
  return mapProject(row);
};

export const updateProjectGithubToken = async (id: string, encrypted: string | null, iv: string | null, tag: string | null): Promise<void> => {
  const db = await getDrizzle();
  db.update(projects).set({ githubTokenEncrypted: encrypted, githubTokenIv: iv, githubTokenTag: tag }).where(eq(projects.id, id)).run();
};

export const listProjects = async (): Promise<Project[]> => {
  const db = await getDrizzle();
  return db.select().from(projects).orderBy(projects.name).all().map(mapProject);
};

export const getProjectById = async (id: string): Promise<Project | null> => {
  const db = await getDrizzle();
  const row = db.select().from(projects).where(eq(projects.id, id)).get();
  return row ? mapProject(row) : null;
};

export const updateProject = async (id: string, patch: Partial<CreateProjectInput>): Promise<Project | null> => {
  const existing = await getProjectById(id);
  if (!existing) return null;
  const db = await getDrizzle();
  const updates: Record<string, unknown> = { updatedAt: now() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.repoUrl !== undefined) updates.repoUrl = patch.repoUrl;
  if (patch.repoBranch !== undefined) updates.repoBranch = patch.repoBranch;
  if (patch.baseDomain !== undefined) updates.baseDomain = patch.baseDomain;
  if (patch.cpuLimit !== undefined) updates.cpuLimit = patch.cpuLimit;
  if (patch.memoryLimitMb !== undefined) updates.memoryLimitMb = patch.memoryLimitMb;
  if (patch.port !== undefined) updates.port = patch.port;
  if (patch.sourceDir !== undefined) updates.sourceDir = patch.sourceDir;
  db.update(projects).set(updates).where(eq(projects.id, id)).run();
  return getProjectById(id);
};

export const deleteProject = async (id: string): Promise<boolean> => {
  const db = await getDrizzle();
  const result = db.delete(projects).where(eq(projects.id, id)).run();
  return result.changes > 0;
};

export const deleteProjectCascade = async (id: string): Promise<ProjectCleanupInfo | null> => {
  const project = await getProjectById(id);
  if (!project) return null;

  const slug = project.name
    ? project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63)
    : id;

  const db = await getDrizzle();

  const depRows = db.select({ id: deployments.id, containerName: deployments.containerName, imageTag: deployments.imageTag })
    .from(deployments).where(eq(deployments.projectId, id)).all();
  const deploymentContainerNames = depRows.filter(d => d.containerName).map(d => d.containerName!);
  const deploymentImageTags = depRows.filter(d => d.imageTag).map(d => d.imageTag!);

  for (const dep of depRows) {
    db.delete(deploymentLogs).where(eq(deploymentLogs.deploymentId, dep.id)).run();
  }
  db.delete(deployments).where(eq(deployments.projectId, id)).run();
  db.delete(environmentVariables).where(eq(environmentVariables.projectId, id)).run();

  const volRows = db.select({ dockerVolumeName: volumes.dockerVolumeName })
    .from(volumes).where(eq(volumes.projectId, id)).all();
  const volumeDockerNames = volRows.filter(v => v.dockerVolumeName).map(v => v.dockerVolumeName!);
  db.delete(volumes).where(eq(volumes.projectId, id)).run();

  const dbRows = db.select({ containerName: databases.containerName, id: databases.id })
    .from(databases).where(eq(databases.projectId, id)).all();
  const databaseContainerNames = dbRows.filter(d => d.containerName).map(d => d.containerName!);
  const databaseVolumeNames = dbRows.map(d => `db-${d.id.slice(0, 12)}`);
  db.delete(databases).where(eq(databases.projectId, id)).run();

  const domainRows = db.select({ domain: domains.domain }).from(domains).where(eq(domains.projectId, id)).all();
  const domainInfo = domainRows.map(d => ({ domain: d.domain, projectName: project.name ?? id }));
  db.delete(domains).where(eq(domains.projectId, id)).run();

  db.delete(scalingPolicies).where(eq(scalingPolicies.projectId, id)).run();
  db.delete(alerts).where(eq(alerts.projectId, id)).run();
  db.delete(projects).where(eq(projects.id, id)).run();

  return {
    deploymentContainerNames,
    deploymentImageTags,
    databaseContainerNames,
    databaseVolumeNames,
    volumeDockerNames,
    domains: domainInfo,
    slug,
    projectName: project.name ?? id,
  };
};
