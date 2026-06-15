import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { alerts } from "../schema";
import type { Alert, CreateAlertInput } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapAlert = (row: typeof alerts.$inferSelect): Alert => ({
  id: row.id,
  projectId: row.projectId,
  type: row.type as Alert["type"],
  threshold: row.threshold,
  durationSeconds: row.durationSeconds,
  channel: row.channel as Alert["channel"],
  destination: row.destination,
  enabled: row.enabled === 1,
  createdAt: row.createdAt,
});

export const createAlert = async (input: CreateAlertInput): Promise<Alert> => {
  const id = randomUUID();
  const timestamp = now();
  const db = await getDrizzle();
  db.insert(alerts).values({
    id,
    projectId: input.projectId,
    type: input.type,
    threshold: input.threshold ?? null,
    durationSeconds: input.durationSeconds ?? null,
    channel: input.channel,
    destination: input.destination ?? null,
    createdAt: timestamp,
  }).run();
  const row = db.select().from(alerts).where(eq(alerts.id, id)).get()!;
  return mapAlert(row);
};

export const listAlerts = async (projectId?: string): Promise<Alert[]> => {
  const db = await getDrizzle();
  const cond = projectId ? eq(alerts.projectId, projectId) : undefined;
  const rows = cond
    ? db.select().from(alerts).where(cond).orderBy(desc(alerts.createdAt)).all()
    : db.select().from(alerts).orderBy(desc(alerts.createdAt)).all();
  return rows.map(mapAlert);
};

export const getAlertById = async (id: string): Promise<Alert | null> => {
  const db = await getDrizzle();
  const row = db.select().from(alerts).where(eq(alerts.id, id)).get();
  return row ? mapAlert(row) : null;
};

export const updateAlertEnabled = async (id: string, enabled: boolean): Promise<Alert | null> => {
  const db = await getDrizzle();
  db.update(alerts).set({ enabled: enabled ? 1 : 0 }).where(eq(alerts.id, id)).run();
  return getAlertById(id);
};

export const deleteAlert = async (id: string): Promise<boolean> => {
  const db = await getDrizzle();
  return db.delete(alerts).where(eq(alerts.id, id)).run().changes > 0;
};
