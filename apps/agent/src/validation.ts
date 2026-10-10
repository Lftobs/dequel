import type {
	RemoteDestroyPayload,
	RemoteGitDeployPayload,
	RemoteRollbackPayload,
	RemoteRoutePayload,
	RemoteScalePayload,
} from "./types";

export const ID_RE = /^[a-zA-Z0-9-]{1,100}$/;
export const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const SHA_RE = /^[0-9a-f]{7,40}$/i;
export const IMAGE_TAG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*:[a-zA-Z0-9._-]+$/;
export const VOLUME_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
export const MOUNT_PATH_RE = /^\/(?:[a-zA-Z0-9._-]+\/?)+$/;
export const HOSTNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?(?::\d{1,5})?$/;
export const ROUTE_FILE_RE = /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.caddy$/;
export const UPSTREAM_HOST_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?(?::\d{1,5})?$/;

export const validateDeploymentPayload = (value: unknown): RemoteGitDeployPayload => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Deployment payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" || !ID_RE.test(input.deploymentId))
		throw new Error("Invalid deployment ID");
	if (typeof input.projectId !== "string" || !ID_RE.test(input.projectId)) throw new Error("Invalid project ID");
	if (typeof input.projectName !== "string" || !input.projectName.trim()) throw new Error("Invalid project name");
	if (typeof input.gitUrl !== "string") throw new Error("Invalid Git URL");
	const gitUrl = new URL(input.gitUrl);
	if (gitUrl.protocol !== "https:" || gitUrl.username || gitUrl.password)
		throw new Error("Only public HTTPS Git URLs are supported");
	if (input.branch !== undefined && (typeof input.branch !== "string" || input.branch.startsWith("-")))
		throw new Error("Invalid Git branch");
	if (input.commitSha !== undefined && (typeof input.commitSha !== "string" || !SHA_RE.test(input.commitSha)))
		throw new Error("Invalid commit SHA");
	if (!Number.isInteger(input.appPort) || Number(input.appPort) < 1 || Number(input.appPort) > 65535)
		throw new Error("Invalid application port");
	if (input.cpuLimit !== undefined && (typeof input.cpuLimit !== "number" || input.cpuLimit <= 0))
		throw new Error("Invalid CPU limit");
	if (input.memoryLimitMb !== undefined && (typeof input.memoryLimitMb !== "number" || input.memoryLimitMb <= 0))
		throw new Error("Invalid memory limit");
	if (
		!Array.isArray(input.environmentVariables) ||
		input.environmentVariables.some(
			(item) =>
				!item ||
				typeof item !== "object" ||
				typeof item.key !== "string" ||
				!ENV_KEY_RE.test(item.key) ||
				typeof item.value !== "string",
		)
	)
		throw new Error("Invalid environment variables");
	return input as RemoteGitDeployPayload;
};

export const validateRollbackPayload = (value: unknown): RemoteRollbackPayload => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Rollback payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" || !ID_RE.test(input.deploymentId))
		throw new Error("Invalid deployment ID");
	if (input.projectId !== null && (typeof input.projectId !== "string" || !ID_RE.test(input.projectId)))
		throw new Error("Invalid project ID");
	if (input.projectName !== null && (typeof input.projectName !== "string" || !input.projectName.trim()))
		throw new Error("Invalid project name");
	if (typeof input.imageTag !== "string" || !IMAGE_TAG_RE.test(input.imageTag)) throw new Error("Invalid image tag");
	if (!Number.isInteger(input.appPort) || Number(input.appPort) < 1 || Number(input.appPort) > 65535)
		throw new Error("Invalid application port");
	if (
		input.cpuLimit !== undefined &&
		input.cpuLimit !== null &&
		(typeof input.cpuLimit !== "number" || input.cpuLimit <= 0)
	)
		throw new Error("Invalid CPU limit");
	if (
		input.memoryLimitMb !== undefined &&
		input.memoryLimitMb !== null &&
		(typeof input.memoryLimitMb !== "number" || input.memoryLimitMb <= 0)
	)
		throw new Error("Invalid memory limit");
	if (
		!Array.isArray(input.environmentVariables) ||
		input.environmentVariables.some(
			(item) =>
				!item ||
				typeof item !== "object" ||
				typeof item.key !== "string" ||
				!ENV_KEY_RE.test(item.key) ||
				typeof item.value !== "string",
		)
	)
		throw new Error("Invalid environment variables");
	if (
		input.volumes !== undefined &&
		(!Array.isArray(input.volumes) ||
			input.volumes.some(
				(v) =>
					!v ||
					typeof v !== "object" ||
					typeof v.volumeName !== "string" ||
					!VOLUME_NAME_RE.test(v.volumeName) ||
					typeof v.mountPath !== "string" ||
					!MOUNT_PATH_RE.test(v.mountPath),
			))
	)
		throw new Error("Invalid volumes");
	return input as RemoteRollbackPayload;
};

export const validateDestroyPayload = (value: unknown): RemoteDestroyPayload => {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Destroy payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" || !ID_RE.test(input.deploymentId))
		throw new Error("Invalid deployment ID");
	if (input.containerName !== null && (typeof input.containerName !== "string" || !ID_RE.test(input.containerName)))
		throw new Error("Invalid container name");
	if (input.imageTag !== null && (typeof input.imageTag !== "string" || !IMAGE_TAG_RE.test(input.imageTag)))
		throw new Error("Invalid image tag");
	return input as RemoteDestroyPayload;
};

export const validateScalePayload = (value: unknown): RemoteScalePayload => {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Scale payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" || !ID_RE.test(input.deploymentId))
		throw new Error("Invalid deployment ID");
	if (input.projectId !== null && (typeof input.projectId !== "string" || !ID_RE.test(input.projectId)))
		throw new Error("Invalid project ID");
	if (input.action !== "up" && input.action !== "down") throw new Error("Invalid scale action");
	if (!Number.isInteger(input.replicas) || Number(input.replicas) < 1 || Number(input.replicas) > 50)
		throw new Error("Invalid replica count");
	if (typeof input.imageTag !== "string" || !IMAGE_TAG_RE.test(input.imageTag)) throw new Error("Invalid image tag");
	if (!Number.isInteger(input.appPort) || Number(input.appPort) < 1 || Number(input.appPort) > 65535)
		throw new Error("Invalid application port");
	if (
		input.cpuLimit !== undefined &&
		input.cpuLimit !== null &&
		(typeof input.cpuLimit !== "number" || input.cpuLimit <= 0)
	)
		throw new Error("Invalid CPU limit");
	if (
		input.memoryLimitMb !== undefined &&
		input.memoryLimitMb !== null &&
		(typeof input.memoryLimitMb !== "number" || input.memoryLimitMb <= 0)
	)
		throw new Error("Invalid memory limit");
	if (
		!Array.isArray(input.environmentVariables) ||
		input.environmentVariables.some(
			(item) =>
				!item ||
				typeof item !== "object" ||
				typeof item.key !== "string" ||
				!ENV_KEY_RE.test(item.key) ||
				typeof item.value !== "string",
		)
	)
		throw new Error("Invalid environment variables");
	return input as RemoteScalePayload;
};

export const validateRoutePayload = (value: unknown): RemoteRoutePayload => {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Route payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" && input.deploymentId !== null) throw new Error("Invalid deployment ID");
	if (input.action !== "add" && input.action !== "remove") throw new Error("Invalid route action");
	if (typeof input.hostname !== "string" || !HOSTNAME_RE.test(input.hostname)) throw new Error("Invalid hostname");
	if (typeof input.routeFile !== "string" || !ROUTE_FILE_RE.test(input.routeFile))
		throw new Error("Invalid route file name");
	if (!Number.isInteger(input.port) || Number(input.port) < 1 || Number(input.port) > 65535)
		throw new Error("Invalid application port");
	if (
		input.upstreamHost !== undefined &&
		(typeof input.upstreamHost !== "string" || !UPSTREAM_HOST_RE.test(input.upstreamHost))
	) {
		throw new Error("Invalid upstream host");
	}
	if (
		!Array.isArray(input.targetContainers) ||
		input.targetContainers.some((c) => typeof c !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(c))
	) {
		throw new Error("Invalid target containers");
	}
	if (input.action === "add" && input.targetContainers.length === 0 && !input.upstreamHost) {
		throw new Error("Target containers required for add action without upstream host");
	}
	return input as RemoteRoutePayload;
};
