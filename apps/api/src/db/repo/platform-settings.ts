import { eq } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { platformSettings } from "../schema";
import { now } from "./helpers";

export interface PlatformSettingsData {
  ingressServerId: string | null;
}

const SETTINGS_ID = "platform";

export const getPlatformSettings = async (): Promise<PlatformSettingsData> => {
  const db = await getDrizzle();
  const row = db.select().from(platformSettings).where(eq(platformSettings.id, SETTINGS_ID)).get();
  return { ingressServerId: row?.ingressServerId ?? null };
};

export const setIngressServer = async (ingressServerId: string | null): Promise<PlatformSettingsData> => {
  const db = await getDrizzle();
  const existing = db.select().from(platformSettings).where(eq(platformSettings.id, SETTINGS_ID)).get();
  if (existing) {
    db.update(platformSettings)
      .set({ ingressServerId, updatedAt: now() })
      .where(eq(platformSettings.id, SETTINGS_ID))
      .run();
  } else {
    db.insert(platformSettings).values({ id: SETTINGS_ID, ingressServerId, updatedAt: now() }).run();
  }
  return { ingressServerId };
};