import { Elysia } from "elysia";
import {
	createDeployment,
	getProjectByDeployWebhookToken,
	getProjectById,
	getServerById,
	listProjectsByTag,
	regenerateDeployWebhookToken,
} from "../../db/repo";
import { resolveDefaultServerId } from "../../utils/server-default";
import { created, fail, ok } from "../response";

const triggerProjectDeploy = async (projectId: string, branch?: string) => {
	const project = await getProjectById(projectId);
	if (!project) throw new Error("Project not found");
	const serverId = await resolveDefaultServerId(project.serverId);
	const server = await getServerById(serverId);
	if (!server) throw new Error("Deployment server not found");
	if (project.sourceType === "image") {
		if (!project.imageRef) throw new Error("Project has no image reference");
		const deployment = await createDeployment({
			projectId,
			serverId,
			sourceType: "image",
			sourceRef: project.imageRef,
			branch: branch ?? null,
		} as any);
		const { dispatchDeployment } = await import("../deployments");
		await dispatchDeployment(deployment, project, server);
		return deployment;
	}
	if (project.sourceType !== "git" || !project.repoUrl) {
		throw new Error("Tag deploys support Git and Docker image sources only");
	}
	const deployment = await createDeployment({
		projectId,
		serverId,
		sourceType: "git",
		sourceRef: project.repoUrl,
		branch: branch ?? project.repoBranch ?? undefined,
	});
	const { dispatchDeployment } = await import("../deployments");
	await dispatchDeployment(deployment, project, server);
	return deployment;
};

export const projectAutomationRoutes = new Elysia()
	.post("/projects/:id/webhook-token", async ({ params: { id }, set }) => {
		const token = await regenerateDeployWebhookToken(id);
		if (!token) {
			set.status = 404;
			return fail("Project not found");
		}
		return ok({ token }, "Deploy webhook token regenerated");
	})
	.post("/projects/by-tag/:tag/deploy", async ({ params: { tag }, body, set }: any) => {
		const projects = await listProjectsByTag(String(tag).toLowerCase());
		if (projects.length === 0) {
			set.status = 404;
			return fail(`No projects tagged ${tag}`);
		}
		const deployments = [];
		const failures: { projectId: string; error: string }[] = [];
		for (const project of projects) {
			try {
				deployments.push(await triggerProjectDeploy(project.id, body?.branch));
			} catch (error) {
				failures.push({ projectId: project.id, error: error instanceof Error ? error.message : String(error) });
			}
		}
		return created({ deployments, failures }, `Triggered ${deployments.length} deployment(s)`);
	})
	.post("/webhooks/deploy/:token", async ({ params: { token }, body, set }) => {
		const project = await getProjectByDeployWebhookToken(token);
		if (!project) {
			set.status = 404;
			return fail("Unknown deploy webhook");
		}
		try {
			const deployment = await triggerProjectDeploy(project.id, body?.branch);
			return created({ deployment }, "Deployment triggered");
		} catch (error) {
			set.status = 400;
			return fail(error instanceof Error ? error.message : "Deployment failed to start");
		}
	});
