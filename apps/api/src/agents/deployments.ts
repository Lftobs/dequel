import {
	appendLog,
	createAgentJob,
	listEnvironmentVariablesForDeploy,
	listVolumes,
	updateDeploymentStatus,
	upsertRoute,
} from "../db/repo";
import type { Deployment, Project } from "../types";
import { routeNamesFor } from "../utils/routes";
import { validateRemoteDeployment } from "./deployment-contract";
import type { RemoteGitDeployPayload } from "./protocol";

export { validateRemoteDeployment } from "./deployment-contract";

export const queueRemoteDeployment = async (deployment: Deployment, project: Project) => {
	const validationError = validateRemoteDeployment(deployment, project);
	if (validationError) throw new Error(validationError);
	if (!deployment.serverId || deployment.serverId === "local")
		throw new Error("Remote deployment requires an agent server");
	const isImage = deployment.sourceType === "image";
	const environmentVariables = (
		await listEnvironmentVariablesForDeploy(project.id, deployment.environment ?? "production")
	).filter((variable) => isImage || variable.scope !== "build");
	const { slug, hostname, routeFile } = routeNamesFor(project.name, project.id, deployment.id);
	const containerName = `${slug}-${deployment.id.slice(0, 8)}`;
	const appPort = project.port || 3000;

	let registryAuth: { url: string; username: string; password: string } | undefined;
	if (isImage) {
		const { findRegistryForImage, getRegistryCredentials } = await import("../db/repo/registries");
		const registryId = project.registryId ?? (await findRegistryForImage(deployment.sourceRef).catch(() => null));
		if (registryId) registryAuth = (await getRegistryCredentials(registryId)) ?? undefined;
	}

	const payload: RemoteGitDeployPayload = {
		deploymentId: deployment.id,
		projectId: project.id,
		projectName: project.name,
		gitUrl: isImage ? undefined : deployment.sourceRef,
		imageRef: isImage ? deployment.sourceRef : undefined,
		imagePullPolicy: isImage ? project.imagePullPolicy : undefined,
		registryAuth,
		containerName,
		volumes: isImage
			? (await listVolumes(project.id)).map((v) => ({
					volumeName: v.dockerVolumeName ?? `vol-${v.id.slice(0, 12)}`,
					mountPath: v.mountPath,
				}))
			: undefined,
		branch: deployment.branch ?? undefined,
		commitSha: deployment.commitSha ?? undefined,
		appPort,
		cpuLimit: project.cpuLimit ?? undefined,
		memoryLimitMb: project.memoryLimitMb ?? undefined,
		environmentVariables,
	};
	await createAgentJob({
		deploymentId: deployment.id,
		serverId: deployment.serverId,
		type: "deploy",
		payload,
		idempotencyKey: `deployment:${deployment.id}`,
	});
	await upsertRoute({
		serverId: deployment.serverId,
		deploymentId: deployment.id,
		projectId: project.id,
		hostname,
		routeFile,
		port: appPort,
		targetContainers: [containerName],
		status: "pending",
	});
	await createAgentJob({
		deploymentId: deployment.id,
		serverId: deployment.serverId,
		type: "reload_routes",
		payload: {
			deploymentId: deployment.id,
			action: "add",
			hostname,
			routeFile,
			port: appPort,
			targetContainers: [containerName],
		},
		idempotencyKey: `route:add:${slug}:${deployment.id}`,
	});
	await updateDeploymentStatus(deployment.id, "pending", { failureReason: null });
	await appendLog(deployment.id, "system", `Deployment queued for server ${deployment.serverId}`);
};
