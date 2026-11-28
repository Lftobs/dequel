import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { NotificationChannel, NotificationEvent } from "../../types";
import { getDb } from "../db-provider";
import { notificationChannels } from "../schema";
import { getRowsAffected, now, pickDefined } from "./helpers";

const CHANNEL_PATCH_FIELDS = [
	"name",
	"channel",
	"destination",
	"events",
	"enabled",
] as const satisfies readonly (keyof typeof notificationChannels.$inferInsert)[];

const mapChannel = (row: typeof notificationChannels.$inferSelect): NotificationChannel => ({
	id: row.id,
	name: row.name,
	channel: row.channel,
	destination: row.destination ?? null,
	enabled: Boolean(row.enabled),
	events: Array.isArray(row.events) ? (row.events as NotificationEvent[]) : [],
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString(),
});

export const createNotificationChannel = async (input: {
	name: string;
	channel: string;
	destination?: string | null;
	events?: NotificationEvent[];
	enabled?: boolean;
}): Promise<NotificationChannel> => {
	const id = randomUUID();
	const timestamp = now();
	const db = await getDb();
	await db
		.insert(notificationChannels)
		.values({
			id,
			name: input.name,
			channel: input.channel,
			destination: input.destination ?? null,
			events: input.events ?? [],
			enabled: input.enabled ?? true,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(notificationChannels).where(eq(notificationChannels.id, id)).execute();
	return mapChannel(row);
};

export const listNotificationChannels = async (): Promise<NotificationChannel[]> => {
	const db = await getDb();
	const rows = await db.select().from(notificationChannels).orderBy(desc(notificationChannels.createdAt)).execute();
	return rows.map(mapChannel);
};

export const updateNotificationChannel = async (
	id: string,
	patch: {
		name?: string;
		channel?: string;
		destination?: string | null;
		events?: NotificationEvent[];
		enabled?: boolean;
	},
): Promise<NotificationChannel | null> => {
	const updates: Partial<typeof notificationChannels.$inferInsert> = {
		...pickDefined(patch, CHANNEL_PATCH_FIELDS),
		updatedAt: now(),
	};
	const db = await getDb();
	const result = await db.update(notificationChannels).set(updates).where(eq(notificationChannels.id, id)).execute();
	if (getRowsAffected(result) === 0) return null;
	const [row] = await db.select().from(notificationChannels).where(eq(notificationChannels.id, id)).execute();
	return row ? mapChannel(row) : null;
};

export const deleteNotificationChannel = async (id: string): Promise<boolean> => {
	const db = await getDb();
	return getRowsAffected(await db.delete(notificationChannels).where(eq(notificationChannels.id, id)).execute()) > 0;
};
