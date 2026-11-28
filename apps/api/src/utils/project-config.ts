import type { HealthCheckConfig, ImagePullPolicy, RestartPolicy } from "../types";

export const BUILD_TYPES = new Set(["railpack", "compose", "dockerfile"]);
export const SOURCE_TYPES = new Set(["git", "upload", "image"]);
export const GIT_PROVIDERS = new Set(["github", "gitlab", "bitbucket", "gitea", "generic"]);
export const IMAGE_PULL_POLICIES = new Set<ImagePullPolicy>(["always", "if-not-present", "never"]);
export const RESTART_POLICIES = new Set<RestartPolicy>(["no", "always", "unless-stopped", "on-failure"]);
export const HEALTH_CHECK_TYPES = new Set(["none", "http", "tcp", "command"]);

const IMAGE_REF_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/;

export const normalizeTags = (value: unknown): string[] => {
	if (!Array.isArray(value)) return [];
	return [
		...new Set(
			value
				.map((tag) => String(tag).trim().toLowerCase())
				.filter((tag) => tag.length > 0 && tag.length <= 32 && /^[a-z0-9][a-z0-9._-]*$/.test(tag)),
		),
	].slice(0, 20);
};

export const validateHealthCheck = (value: unknown): { value?: HealthCheckConfig; error?: string } => {
	if (value === undefined || value === null) return {};
	if (typeof value !== "object") return { error: "healthCheck must be an object" };
	const input = value as any;
	const type = String(input.type ?? "none");
	if (!HEALTH_CHECK_TYPES.has(type)) return { error: "healthCheck.type must be none, http, tcp, or command" };
	if (type === "none") return { value: { type: "none" } };
	const port = input.port === null || input.port === undefined ? null : Number(input.port);
	if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
		return { error: "healthCheck.port must be between 1 and 65535" };
	}
	const command = input.command ? String(input.command) : null;
	if (type === "command" && !command) return { error: "healthCheck.command is required for command checks" };
	const intervalSeconds = Number(input.intervalSeconds ?? 10);
	const timeoutSeconds = Number(input.timeoutSeconds ?? 3);
	const startPeriodSeconds = Number(input.startPeriodSeconds ?? 5);
	const retries = Number(input.retries ?? 3);
	if (intervalSeconds < 1 || intervalSeconds > 300) return { error: "healthCheck.intervalSeconds must be 1-300" };
	if (timeoutSeconds < 1 || timeoutSeconds > 300) return { error: "healthCheck.timeoutSeconds must be 1-300" };
	if (startPeriodSeconds < 0 || startPeriodSeconds > 600)
		return { error: "healthCheck.startPeriodSeconds must be 0-600" };
	if (retries < 1 || retries > 20) return { error: "healthCheck.retries must be 1-20" };
	return {
		value: {
			type: type as HealthCheckConfig["type"],
			path: type === "http" ? String(input.path || "/") : null,
			port,
			command: type === "command" ? command : null,
			intervalSeconds,
			timeoutSeconds,
			startPeriodSeconds,
			retries,
		},
	};
};

export const validateProjectConfig = (
	body: any,
	options: { partial?: boolean } = {},
): { error?: string; healthCheck?: HealthCheckConfig | null; tags?: string[] } => {
	if (body?.buildType !== undefined && !BUILD_TYPES.has(String(body.buildType))) {
		return { error: "buildType must be railpack, compose, or dockerfile" };
	}
	if (body?.sourceType !== undefined && !SOURCE_TYPES.has(String(body.sourceType))) {
		return { error: "sourceType must be git, upload, or image" };
	}
	if (body?.gitProvider !== undefined && !GIT_PROVIDERS.has(String(body.gitProvider))) {
		return { error: "gitProvider must be github, gitlab, bitbucket, gitea, or generic" };
	}
	if (body?.imagePullPolicy !== undefined && !IMAGE_PULL_POLICIES.has(body.imagePullPolicy)) {
		return { error: "imagePullPolicy must be always, if-not-present, or never" };
	}
	if (body?.restartPolicy !== undefined && !RESTART_POLICIES.has(body.restartPolicy)) {
		return { error: "restartPolicy must be no, always, unless-stopped, or on-failure" };
	}
	if (body?.restartMaxRetries !== undefined && body.restartMaxRetries !== null) {
		const retries = Number(body.restartMaxRetries);
		if (!Number.isInteger(retries) || retries < 0 || retries > 100) {
			return { error: "restartMaxRetries must be 0-100" };
		}
	}
	if (body?.stopGracePeriodSeconds !== undefined && body.stopGracePeriodSeconds !== null) {
		const seconds = Number(body.stopGracePeriodSeconds);
		if (!Number.isInteger(seconds) || seconds < 0 || seconds > 300) {
			return { error: "stopGracePeriodSeconds must be 0-300" };
		}
	}
	if (body?.imageRef !== undefined && body.imageRef !== null && String(body.imageRef).trim()) {
		const imageRef = String(body.imageRef).trim();
		if (imageRef.length > 512 || !IMAGE_REF_RE.test(imageRef)) {
			return { error: "imageRef is not a valid image reference" };
		}
	}
	if (body?.dockerfilePath !== undefined && body.dockerfilePath !== null && String(body.dockerfilePath).length > 512) {
		return { error: "dockerfilePath is too long" };
	}
	if (body?.tags !== undefined && !Array.isArray(body.tags)) {
		return { error: "tags must be an array" };
	}
	const health = validateHealthCheck(body?.healthCheck);
	if (health.error) return { error: health.error };
	if (!options.partial) {
		const sourceType = String(body?.sourceType ?? "git");
		if (sourceType === "image" && !String(body?.imageRef ?? "").trim()) {
			return { error: "imageRef is required when sourceType is image" };
		}
		if (String(body?.buildType ?? "railpack") === "dockerfile" && sourceType === "image") {
			return { error: "A Docker image source cannot use the dockerfile build method" };
		}
	}
	return {
		healthCheck: health.value,
		tags: body?.tags !== undefined ? normalizeTags(body.tags) : undefined,
	};
};
