import { pickDefined } from "../../db/repo/helpers";
import type { CreateProjectInput, HealthCheckConfig } from "../../types";

const PROJECT_DIRECT_PATCH_FIELDS = [
	"name",
	"serverId",
	"description",
	"baseDomain",
	"repoUrl",
	"repoBranch",
	"cpuLimit",
	"memoryLimitMb",
	"projectType",
	"buildType",
	"sourceType",
	"gitProvider",
	"imagePullPolicy",
	"restartPolicy",
	"cancelOlderDeployments",
	"maintenanceEnabled",
] as const satisfies readonly (keyof CreateProjectInput)[];

const PROJECT_NULLABLE_STRING_FIELDS = [
	"sourceDir",
	"composeService",
	"buildCommand",
	"installCommand",
	"outputDir",
	"startCommand",
	"gitToken",
	"dockerfilePath",
	"dockerTarget",
	"imageRef",
	"registryId",
	"preDeployCommand",
	"postDeployCommand",
	"maintenanceMessage",
] as const satisfies readonly (keyof CreateProjectInput)[];

const pickNullableStrings = <K extends string>(
	body: Record<string, unknown>,
	keys: readonly K[],
): Partial<Record<K, string | null>> => {
	const result: Partial<Record<K, string | null>> = {};
	for (const key of keys) {
		if (key in body) {
			const val = body[key];
			result[key] = val ? String(val) : null;
		}
	}
	return result;
};

const parseNullableInt = (
	body: Record<string, unknown>,
	key: string,
	zeroAsNull = false,
): number | null | undefined => {
	if (!(key in body)) return undefined;
	const value = body[key];
	if (zeroAsNull) return value ? Number(value) : null;
	return value === null ? null : Number(value);
};

export const buildProjectPatch = (
	body: Record<string, unknown> | undefined,
	projectConfig: { healthCheck?: HealthCheckConfig | null; tags?: string[] },
): Partial<CreateProjectInput> => {
	const payload: Record<string, unknown> = body ?? {};
	return {
		...pickDefined<Partial<CreateProjectInput>, typeof PROJECT_DIRECT_PATCH_FIELDS>(
			payload,
			PROJECT_DIRECT_PATCH_FIELDS,
		),
		...pickNullableStrings(payload, PROJECT_NULLABLE_STRING_FIELDS),
		port: parseNullableInt(payload, "port", true),
		composePort: parseNullableInt(payload, "composePort", true),
		restartMaxRetries: parseNullableInt(payload, "restartMaxRetries"),
		stopGracePeriodSeconds: parseNullableInt(payload, "stopGracePeriodSeconds"),
		composeServices:
			"composeServices" in payload
				? payload.composeServices
					? typeof payload.composeServices === "string"
						? payload.composeServices
						: JSON.stringify(payload.composeServices)
					: null
				: undefined,
		healthCheck: "healthCheck" in payload ? projectConfig.healthCheck : undefined,
		tags: projectConfig.tags ?? undefined,
	};
};
