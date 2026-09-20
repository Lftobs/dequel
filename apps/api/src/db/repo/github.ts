import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { GithubIntegration } from "../../types";
import { getDb } from "../db-provider";
import { githubIntegrations } from "../schema";
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
	const db = await getDb();
	const [row] = await db
		.select()
		.from(githubIntegrations)
		.orderBy(desc(githubIntegrations.createdAt))
		.limit(1)
		.execute();
	return row ? mapGithubIntegration(row) : null;
};

export const setGithubIntegration = async (input: {
	clientId: string;
	clientSecret: string;
	appName?: string;
	webhookSecret?: string;
}): Promise<GithubIntegration> => {
	const db = await getDb();

	return db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(githubIntegrations)
			.orderBy(desc(githubIntegrations.createdAt))
			.limit(1)
			.execute();
		const timestamp = now();

		if (existing) {
			await tx
				.update(githubIntegrations)
				.set({
					clientId: input.clientId,
					clientSecret: input.clientSecret,
					appName: input.appName ?? "Dequel",
					webhookSecret: input.webhookSecret ?? existing.webhookSecret,
				})
				.where(eq(githubIntegrations.id, existing.id))
				.execute();
			const [updated] = await tx
				.select()
				.from(githubIntegrations)
				.where(eq(githubIntegrations.id, existing.id))
				.execute();
			return mapGithubIntegration(updated);
		}

		const id = randomUUID();
		await tx
			.insert(githubIntegrations)
			.values({
				id,
				clientId: input.clientId,
				clientSecret: input.clientSecret,
				appName: input.appName ?? "Dequel",
				webhookSecret: input.webhookSecret ?? null,
				createdAt: timestamp,
			})
			.execute();
		const [inserted] = await tx.select().from(githubIntegrations).where(eq(githubIntegrations.id, id)).execute();
		return mapGithubIntegration(inserted);
	});
};
