import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { CreateScalingPolicyInput, ScalingPolicy } from "../../types";
import { getDb } from "../db-provider";
import { scalingPolicies } from "../schema";
import { getRowsAffected, now } from "./helpers";

const mapScalingPolicy = (row: typeof scalingPolicies.$inferSelect): ScalingPolicy => ({
	id: row.id,
	projectId: row.projectId,
	minReplicas: row.minReplicas,
	maxReplicas: row.maxReplicas,
	cpuThresholdPercent: row.cpuThresholdPercent,
	memoryThresholdPercent: row.memoryThresholdPercent,
	cooldownSeconds: row.cooldownSeconds,
	enabled: row.enabled,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

export class ScalingRangeError extends Error {
	constructor(message = "maxReplicas must be greater than or equal to minReplicas") {
		super(message);
		this.name = "ScalingRangeError";
	}
}

export const upsertScalingPolicy = async (input: CreateScalingPolicyInput): Promise<ScalingPolicy> => {
	const db = await getDb();
	const timestamp = now();
	return db.transaction(async (tx) => {
		const existing = await tx
			.select()
			.from(scalingPolicies)
			.where(eq(scalingPolicies.projectId, input.projectId))
			.for("update")
			.execute();
		const current = existing[0];
		const minReplicas = input.minReplicas ?? current?.minReplicas ?? 1;
		const maxReplicas = input.maxReplicas ?? current?.maxReplicas ?? 5;
		if (maxReplicas < minReplicas) throw new ScalingRangeError();
		if (current) {
			const updates: Record<string, unknown> = { updatedAt: timestamp };
			if (input.minReplicas !== undefined) updates.minReplicas = input.minReplicas;
			if (input.maxReplicas !== undefined) updates.maxReplicas = input.maxReplicas;
			if (input.cpuThresholdPercent !== undefined) updates.cpuThresholdPercent = input.cpuThresholdPercent;
			if (input.memoryThresholdPercent !== undefined) updates.memoryThresholdPercent = input.memoryThresholdPercent;
			if (input.cooldownSeconds !== undefined) updates.cooldownSeconds = input.cooldownSeconds;
			if (input.enabled !== undefined) updates.enabled = input.enabled;
			await tx.update(scalingPolicies).set(updates).where(eq(scalingPolicies.projectId, input.projectId)).execute();
			const [updated] = await tx
				.select()
				.from(scalingPolicies)
				.where(eq(scalingPolicies.projectId, input.projectId))
				.execute();
			return mapScalingPolicy(updated);
		}
		const id = randomUUID();
		await tx
			.insert(scalingPolicies)
			.values({
				id,
				projectId: input.projectId,
				minReplicas,
				maxReplicas,
				cpuThresholdPercent: input.cpuThresholdPercent ?? 70,
				memoryThresholdPercent: input.memoryThresholdPercent ?? 85,
				cooldownSeconds: input.cooldownSeconds ?? 120,
				enabled: input.enabled !== undefined ? input.enabled : true,
				createdAt: timestamp,
				updatedAt: timestamp,
			})
			.execute();
		const [row] = await tx.select().from(scalingPolicies).where(eq(scalingPolicies.id, id)).execute();
		return mapScalingPolicy(row);
	});
};

export const getScalingPolicy = async (projectId: string): Promise<ScalingPolicy | null> => {
	const db = await getDb();
	const [row] = await db.select().from(scalingPolicies).where(eq(scalingPolicies.projectId, projectId)).execute();
	return row ? mapScalingPolicy(row) : null;
};

export const deleteScalingPolicy = async (projectId: string): Promise<boolean> => {
	const db = await getDb();
	return (
		getRowsAffected(await db.delete(scalingPolicies).where(eq(scalingPolicies.projectId, projectId)).execute()) > 0
	);
};
