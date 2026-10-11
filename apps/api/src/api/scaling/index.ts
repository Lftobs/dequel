import { Elysia } from "elysia";
import {
	deleteScalingPolicy,
	getProjectById,
	getScalingPolicy,
	ScalingRangeError,
	upsertScalingPolicy,
} from "../../db/repo";
import { fail, ok } from "../response";

const MAX_REPLICAS = 100;

const isPercent = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;

const isMinReplicas = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_REPLICAS;

const isMaxReplicas = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_REPLICAS;

const isCooldown = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 86_400;

const validatePolicyBody = (body: any): string | null => {
	if (body.cpuThresholdPercent !== undefined && !isPercent(body.cpuThresholdPercent)) {
		return "cpuThresholdPercent must be an integer between 0 and 100";
	}
	if (body.memoryThresholdPercent !== undefined && !isPercent(body.memoryThresholdPercent)) {
		return "memoryThresholdPercent must be an integer between 0 and 100";
	}
	if (body.minReplicas !== undefined && !isMinReplicas(body.minReplicas)) {
		return `minReplicas must be an integer between 0 and ${MAX_REPLICAS}`;
	}
	if (body.maxReplicas !== undefined && !isMaxReplicas(body.maxReplicas)) {
		return `maxReplicas must be an integer between 1 and ${MAX_REPLICAS}`;
	}
	if (body.cooldownSeconds !== undefined && !isCooldown(body.cooldownSeconds)) {
		return "cooldownSeconds must be an integer between 1 and 86400";
	}
	if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
		return "enabled must be a boolean";
	}
	return null;
};

export const scalingRoutes = new Elysia()
	.get("/projects/:id/scaling", async ({ params, set }) => {
		const policy = await getScalingPolicy(params.id);
		if (!policy) {
			set.status = 404;
			return fail("No scaling policy configured");
		}
		return ok(policy);
	})
	.put("/projects/:id/scaling", async ({ params, body, set }: any) => {
		if (!body) {
			set.status = 400;
			return fail("body is required");
		}
		const bodyError = validatePolicyBody(body);
		if (bodyError) {
			set.status = 400;
			return fail(bodyError);
		}
		const project = await getProjectById(params.id);
		if (!project) {
			set.status = 404;
			return fail("Project not found");
		}
		if (body.enabled !== false && (!project.cpuLimit || project.cpuLimit <= 0)) {
			set.status = 400;
			return fail("Cannot enable autoscaling on a project without CPU resource limits configured.");
		}
		try {
			return ok(
				await upsertScalingPolicy({
					projectId: params.id,
					...body,
				}),
			);
		} catch (err) {
			if (err instanceof ScalingRangeError) {
				set.status = 400;
				return fail(err.message);
			}
			throw err;
		}
	})
	.delete("/projects/:id/scaling", async ({ params }) => {
		await deleteScalingPolicy(params.id);
		return ok(null, "Scaling policy deleted");
	});
