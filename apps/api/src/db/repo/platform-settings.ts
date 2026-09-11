import { eq } from "drizzle-orm";
import { getDb } from "../db-provider";
import { platformSettings } from "../schema";
import { now } from "./helpers";

export interface PlatformSettingsData {
	ingressServerId: string | null;
}

const SETTINGS_ID = "platform";

export const getPlatformSettings = async (): Promise<PlatformSettingsData> => {
	const db = await getDb();
	const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, SETTINGS_ID)).execute();
	return { ingressServerId: row?.ingressServerId ?? null };
};

export const setIngressServer = async (ingressServerId: string | null): Promise<PlatformSettingsData> => {
	const db = await getDb();
	await db
		.insert(platformSettings)
		.values({ id: SETTINGS_ID, ingressServerId, updatedAt: now() })
		.onConflictDoUpdate({ target: platformSettings.id, set: { ingressServerId, updatedAt: now() } })
		.execute();
	return { ingressServerId };
};
