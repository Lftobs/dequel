import { Elysia } from "elysia";
import { deleteScalingPolicy, getProjectById, getScalingPolicy, upsertScalingPolicy } from "../../db/repo";
import { fail, ok } from "../response";

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
		const project = await getProjectById(params.id);
		if (!project) {
			set.status = 404;
			return fail("Project not found");
		}
		if (body.enabled !== false && (!project.cpuLimit || project.cpuLimit <= 0)) {
			set.status = 400;
			return fail("Cannot enable autoscaling on a project without CPU resource limits configured.");
		}
		return ok(
			await upsertScalingPolicy({
				projectId: params.id,
				...body,
			}),
		);
	})
	.delete("/projects/:id/scaling", async ({ params }) => {
		await deleteScalingPolicy(params.id);
		return ok(null, "Scaling policy deleted");
	});
