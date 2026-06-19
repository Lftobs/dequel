import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { volumes } from "../schema";
import type { Volume, CreateVolumeInput } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapVolume = (row: typeof volumes.$inferSelect): Volume => ({
  id: row.id,
  projectId: row.projectId,
  mountPath: row.mountPath,
  sizeMb: row.sizeMb,
  dockerVolumeName: row.dockerVolumeName,
  createdAt: row.createdAt,
});

export const createVolume = async (input: CreateVolumeInput): Promise<Volume> => {
  const id = randomUUID();
  const timestamp = now();
  const mountPath = input.mountPath ?? "/app/data";
  const volumeName = `vol-${id.slice(0, 8)}`;
  const db = await getDrizzle();
  db.insert(volumes).values({
    id,
    projectId: input.projectId,
    mountPath,
    dockerVolumeName: volumeName,
    createdAt: timestamp,
  }).run();
  const row = db.select().from(volumes).where(eq(volumes.id, id)).get()!;
  return mapVolume(row);
};

export const listVolumes = async (projectId: string): Promise<Volume[]> => {
  const db = await getDrizzle();
  return db.select().from(volumes).where(eq(volumes.projectId, projectId)).orderBy(desc(volumes.createdAt)).all().map(mapVolume);
};

export const getVolumeById = async (id: string): Promise<Volume | null> => {
  const db = await getDrizzle();
  const row = db.select().from(volumes).where(eq(volumes.id, id)).get();
  return row ? mapVolume(row) : null;
};

export const deleteVolume = async (id: string): Promise<boolean> => {
  const db = await getDrizzle();
  return db.delete(volumes).where(eq(volumes.id, id)).run().changes > 0;
};
