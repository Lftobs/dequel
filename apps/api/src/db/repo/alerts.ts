import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Alert, CreateAlertInput } from "../../types";
import { getDb } from "../db-provider";
import { alerts } from "../schema";
import { getRowsAffected, now } from "./helpers";

const mapAlert = (row: typeof alerts.$inferSelect): Alert => ({
	id: row.id,
	projectId: row.projectId,
	type: row.type as Alert["type"],
	threshold: row.threshold,
	durationSeconds: row.durationSeconds,
	channel: row.channel as Alert["channel"],
	destination: row.destination,
	enabled: row.enabled,
	createdAt: row.createdAt,
});

export const createAlert = async (input: CreateAlertInput): Promise<Alert> => {
	const id = randomUUID();
	const timestamp = now();
	const db = await getDb();
	await db
		.insert(alerts)
		.values({
			id,
			projectId: input.projectId,
			type: input.type,
			threshold: input.threshold ?? null,
			durationSeconds: input.durationSeconds ?? null,
			channel: input.channel,
			destination: input.destination ?? null,
			createdAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(alerts).where(eq(alerts.id, id)).execute();
	return mapAlert(row);
};

export const listAlerts = async (projectId?: string): Promise<Alert[]> => {
	const db = await getDb();
	const cond = projectId ? eq(alerts.projectId, projectId) : undefined;
	const rows = cond
		? await db.select().from(alerts).where(cond).orderBy(desc(alerts.createdAt)).execute()
		: await db.select().from(alerts).orderBy(desc(alerts.createdAt)).execute();
	return rows.map(mapAlert);
};

export const getAlertById = async (id: string): Promise<Alert | null> => {
	const db = await getDb();
	const [row] = await db.select().from(alerts).where(eq(alerts.id, id)).execute();
	return row ? mapAlert(row) : null;
};

export const updateAlertEnabled = async (id: string, enabled: boolean): Promise<Alert | null> => {
	const db = await getDb();
	await db.update(alerts).set({ enabled }).where(eq(alerts.id, id)).execute();
	return getAlertById(id);
};

export const deleteAlert = async (id: string): Promise<boolean> => {
	const db = await getDb();
	return getRowsAffected(await db.delete(alerts).where(eq(alerts.id, id)).execute()) > 0;
};
