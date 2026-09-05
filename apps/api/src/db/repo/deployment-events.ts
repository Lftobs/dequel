import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db-provider";
import { deploymentEvents } from "../schema";

export const createDeploymentEvent = async (input: {
	deploymentId: string;
	type: string;
	message?: string;
	metadata?: Record<string, unknown>;
}) => {
	const db = await getDb();
	const id = randomUUID();
	await db
		.insert(deploymentEvents)
		.values({
			id,
			deploymentId: input.deploymentId,
			type: input.type,
			message: input.message ?? null,
			metadata: input.metadata ?? null,
		})
		.execute();
	return id;
};

export const listDeploymentEvents = async (deploymentId: string) => {
	const db = await getDb();
	return db
		.select()
		.from(deploymentEvents)
		.where(eq(deploymentEvents.deploymentId, deploymentId))
		.orderBy(deploymentEvents.createdAt)
		.execute();
};
