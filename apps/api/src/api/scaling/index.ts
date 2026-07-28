import { Elysia } from "elysia";
import {
	deleteScalingPolicy,
	getScalingPolicy,
	upsertScalingPolicy,
	getProjectById,
} from "../../db/repo";

export const scalingRoutes = new Elysia()
	.get(
		"/projects/:id/scaling",
		async ({ params, set }) => {
			const policy = await getScalingPolicy(params.id);
			if (!policy) {
				set.status = 404;
				return { error: "No scaling policy configured" };
			}
			return policy;
		},
	)
	.put(
		"/projects/:id/scaling",
		async ({ params, body, set }: any) => {
			if (!body) {
				set.status = 400;
				return { error: "body is required" };
			}
			const project = await getProjectById(params.id);
			if (!project) {
				set.status = 404;
				return { error: "Project not found" };
			}
			if (body.enabled !== false && (!project.cpuLimit || project.cpuLimit <= 0)) {
				set.status = 400;
				return { error: "Cannot enable autoscaling on a project without CPU resource limits configured." };
			}
			return upsertScalingPolicy({
				projectId: params.id,
				...body,
			});
		},
	)
	.delete(
		"/projects/:id/scaling",
		async ({ params }) => {
			await deleteScalingPolicy(params.id);
			return { ok: true };
		},
	);
