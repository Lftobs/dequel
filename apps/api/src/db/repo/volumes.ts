import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateVolumeInput, Volume } from "../../types";
import { getDb } from "../db-provider";
import { volumes } from "../schema";
import { getRowsAffected, now } from "./helpers";

const mapVolume = (row: typeof volumes.$inferSelect): Volume => ({
	id: row.id,
	projectId: row.projectId,
	mountPath: row.mountPath,
	sizeMb: row.sizeMb,
	dockerVolumeName: row.dockerVolumeName,
	createdAt: row.createdAt,
});

export const composeVolumeNamePrefix = (projectId: string): string => {
	const idPart = projectId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
	return `dq-${idPart}-`;
};

export const isComposeStackVolume = (dockerVolumeName: string | null | undefined, projectId: string): boolean =>
	Boolean(dockerVolumeName?.startsWith(composeVolumeNamePrefix(projectId)));

const safeMountPath = (raw: string): string => {
	const path = raw.split(":")[0]?.trim() ?? "";
	return path.startsWith("/") ? path : "";
};

export interface ComposeVolumeMount {
	volumeKey: string;
	containerPath: string;
}

export const joinComposeMounts = (mounts: ComposeVolumeMount[]): ComposeVolumeEntry[] => {
	const byVolume = new Map<string, string[]>();
	for (const m of mounts) {
		const path = safeMountPath(m.containerPath);
		if (!path) continue;
		const list = byVolume.get(m.volumeKey) ?? [];
		if (!list.includes(path)) list.push(path);
		byVolume.set(m.volumeKey, list);
	}
	return [...byVolume.entries()].map(([volumeKey, paths]) => ({
		dockerVolumeName: volumeKey,
		mountPath: paths.join(", "),
	}));
};

export interface ComposeVolumeEntry {
	dockerVolumeName: string;
	mountPath: string;
}

export const syncComposeStackVolumes = async (projectId: string, mounts: ComposeVolumeMount[]): Promise<void> => {
	const entries = joinComposeMounts(mounts);
	const db = await getDb();
	const existing = await db.select().from(volumes).where(eq(volumes.projectId, projectId)).execute();
	const prefix = composeVolumeNamePrefix(projectId);
	const desired = new Set(entries.map((e) => e.dockerVolumeName));

	for (const entry of entries) {
		const matched = existing.find((row) => row.dockerVolumeName === entry.dockerVolumeName);
		if (matched) {
			if (matched.mountPath !== entry.mountPath) {
				await db.update(volumes).set({ mountPath: entry.mountPath }).where(eq(volumes.id, matched.id)).execute();
			}
			continue;
		}
		await db
			.insert(volumes)
			.values({
				id: randomUUID(),
				projectId,
				mountPath: entry.mountPath,
				dockerVolumeName: entry.dockerVolumeName,
				createdAt: now(),
			})
			.execute();
	}

	for (const row of existing) {
		if (row.dockerVolumeName?.startsWith(prefix) && !desired.has(row.dockerVolumeName)) {
			await db.delete(volumes).where(eq(volumes.id, row.id)).execute();
		}
	}
};

export const createVolume = async (input: CreateVolumeInput): Promise<Volume> => {
	const id = randomUUID();
	const timestamp = now();
	const mountPath = input.mountPath ?? "/app/data";
	const volumeName = `vol-${id.slice(0, 8)}`;
	const db = await getDb();
	await db
		.insert(volumes)
		.values({
			id,
			projectId: input.projectId,
			mountPath,
			dockerVolumeName: volumeName,
			createdAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(volumes).where(eq(volumes.id, id)).execute();
	return mapVolume(row);
};

export const listVolumes = async (projectId: string): Promise<Volume[]> => {
	const db = await getDb();
	const rows = await db
		.select()
		.from(volumes)
		.where(eq(volumes.projectId, projectId))
		.orderBy(desc(volumes.createdAt))
		.execute();
	return rows.map(mapVolume);
};

export const getVolumeById = async (id: string): Promise<Volume | null> => {
	const db = await getDb();
	const [row] = await db.select().from(volumes).where(eq(volumes.id, id)).execute();
	return row ? mapVolume(row) : null;
};

export const deleteVolume = async (id: string): Promise<boolean> => {
	const db = await getDb();
	return getRowsAffected(await db.delete(volumes).where(eq(volumes.id, id)).execute()) > 0;
};
