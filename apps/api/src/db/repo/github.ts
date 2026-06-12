import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { githubIntegrations } from "../schema";
import type { GithubIntegration } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapGithubIntegration = (row: typeof githubIntegrations.$inferSelect): GithubIntegration => ({
  id: row.id,
  clientId: row.clientId,
  clientSecret: row.clientSecret,
  appName: row.appName,
  webhookSecret: row.webhookSecret ?? null,
  createdAt: row.createdAt,
});

export const getGithubIntegration = async (): Promise<GithubIntegration | null> => {
  const db = await getDrizzle();
  const row = db.select().from(githubIntegrations).orderBy(desc(githubIntegrations.createdAt)).limit(1).get();
  return row ? mapGithubIntegration(row) : null;
};

export const setGithubIntegration = async (input: { clientId: string; clientSecret: string; appName?: string; webhookSecret?: string }): Promise<GithubIntegration> => {
  const db = await getDrizzle();

  return db.transaction((tx) => {
    const existing = tx.select().from(githubIntegrations).orderBy(desc(githubIntegrations.createdAt)).limit(1).get();
    const timestamp = now();

    if (existing) {
      tx.update(githubIntegrations).set({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        appName: input.appName ?? "Dequel",
        webhookSecret: input.webhookSecret ?? null,
      }).where(eq(githubIntegrations.id, existing.id)).run();
      const updated = tx.select().from(githubIntegrations).where(eq(githubIntegrations.id, existing.id)).get()!;
      return mapGithubIntegration(updated);
    }

    const id = randomUUID();
    tx.insert(githubIntegrations).values({
      id,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      appName: input.appName ?? "Dequel",
      webhookSecret: input.webhookSecret ?? null,
      createdAt: timestamp,
    }).run();
    const inserted = tx.select().from(githubIntegrations).where(eq(githubIntegrations.id, id)).get()!;
    return mapGithubIntegration(inserted);
  });
};
