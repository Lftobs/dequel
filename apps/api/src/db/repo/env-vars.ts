import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { CreateEnvironmentVariableInput, EnvironmentVariable, EnvVarScope } from "../../types";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { environmentVariables } from "../schema";
import { getRowsAffected, now } from "./helpers";

const mapEnvVar = (row: typeof environmentVariables.$inferSelect): EnvironmentVariable => ({
	id: row.id,
	projectId: row.projectId,
	key: row.key,
	value: row.value ?? "",
	environment: row.environment,
	scope: (row.scope ?? "both") as EnvVarScope,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

export const createEnvironmentVariable = async (
	input: CreateEnvironmentVariableInput,
): Promise<EnvironmentVariable> => {
	const id = randomUUID();
	const timestamp = now();
	const env = input.environment ?? "production";
	const encrypted = encryptValue(input.value, config.envEncryptionKey);
	const db = await getDb();
	await db
		.insert(environmentVariables)
		.values({
			id,
			projectId: input.projectId,
			key: input.key,
			value: "",
			valueEncrypted: encrypted.encrypted,
			valueIv: encrypted.iv,
			valueTag: encrypted.tag,
			environment: env,
			scope: input.scope ?? "both",
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(environmentVariables).where(eq(environmentVariables.id, id)).execute();
	return mapEnvVar(row);
};

export const seedComposeEnvVars = async (
	projectId: string,
	environment: string | undefined,
	refs: { key: string; mode: string; defaultValue: string | null }[],
): Promise<Map<string, string>> => {
	const env = environment ?? "production";
	const keys = [...new Set(refs.map((r) => r.key))];
	if (keys.length === 0) return new Map();
	const db = await getDb();
	const existing = await db
		.select({ key: environmentVariables.key })
		.from(environmentVariables)
		.where(
			and(
				eq(environmentVariables.projectId, projectId),
				eq(environmentVariables.environment, env),
				inArray(environmentVariables.key, keys),
			),
		)
		.execute();
	const present = new Set(existing.map((r) => r.key));
	const seeded = new Map<string, string>();
	for (const ref of refs) {
		if (present.has(ref.key)) continue;
		const initial = ref.mode === "default" || ref.mode === "defaultUnset" ? (ref.defaultValue ?? "") : "";
		await createEnvironmentVariable({ projectId, key: ref.key, value: initial, environment: env });
		seeded.set(ref.key, initial);
		present.add(ref.key);
	}
	return seeded;
};

export const listEnvironmentVariables = async (
	projectId: string,
	environment?: string,
): Promise<EnvironmentVariable[]> => {
	const db = await getDb();
	const cond = environment
		? and(eq(environmentVariables.projectId, projectId), eq(environmentVariables.environment, environment))
		: eq(environmentVariables.projectId, projectId);
	const rows = await db
		.select()
		.from(environmentVariables)
		.where(cond)
		.orderBy(asc(environmentVariables.key))
		.execute();
	return rows.map(mapEnvVar);
};

const expandTemplateValues = (
	values: { key: string; value: string; scope?: EnvVarScope }[],
): { key: string; value: string; scope?: EnvVarScope }[] => {
	const TEMPLATE_RE = /\{\{environment\.([A-Za-z_][A-Za-z0-9_]*)\}\}/g;
	const byKey = new Map(values.map((v) => [v.key, v.value]));
	const depth = new Map<string, number>();

	const resolveValue = (value: string, origin: string): string => {
		return value.replace(TEMPLATE_RE, (_match, refKey: string) => {
			if (refKey === origin) return "";
			const seen = (depth.get(origin) ?? 0) + 1;
			if (seen > 5) throw new Error(`Environment variable template cycle involving ${origin}`);
			depth.set(origin, seen);
			const target = byKey.get(refKey);
			if (target === undefined) return "";
			const expanded = resolveValue(target, origin);
			depth.set(origin, seen - 1);
			return expanded;
		});
	};

	return values.map((v) => ({ ...v, value: resolveValue(v.value, v.key) }));
};

export const listEnvironmentVariablesForDeploy = async (
	projectId: string,
	environment?: string,
): Promise<{ key: string; value: string; scope: EnvVarScope }[]> => {
	const db = await getDb();
	const cond = environment
		? and(eq(environmentVariables.projectId, projectId), eq(environmentVariables.environment, environment))
		: eq(environmentVariables.projectId, projectId);
	const rows = await db
		.select({
			key: environmentVariables.key,
			value: environmentVariables.value,
			scope: environmentVariables.scope,
			valueEncrypted: environmentVariables.valueEncrypted,
			valueIv: environmentVariables.valueIv,
			valueTag: environmentVariables.valueTag,
		})
		.from(environmentVariables)
		.where(cond)
		.orderBy(asc(environmentVariables.key))
		.execute();
	const localVars = rows.map((row) => {
		if (row.valueEncrypted && row.valueIv && row.valueTag) {
			return {
				key: row.key,
				value: decryptValue(row.valueEncrypted, row.valueIv, row.valueTag, config.envEncryptionKey),
				scope: (row.scope ?? "both") as EnvVarScope,
			};
		}
		return { key: row.key, value: row.value ?? "", scope: (row.scope ?? "both") as EnvVarScope };
	});

	const { listSharedEnvVarsForDeploy } = await import("./shared-env-vars");
	const sharedVars = await listSharedEnvVarsForDeploy(projectId, environment);

	const merged = [...sharedVars.filter((v) => !localVars.some((l) => l.key === v.key)), ...localVars];
	return expandTemplateValues(merged) as { key: string; value: string; scope: EnvVarScope }[];
};

export const getEnvironmentVariableById = async (id: string): Promise<EnvironmentVariable | null> => {
	const db = await getDb();
	const [row] = await db.select().from(environmentVariables).where(eq(environmentVariables.id, id)).execute();
	return row ? mapEnvVar(row) : null;
};

export const getEnvironmentVariablePlaintext = async (id: string): Promise<string | null> => {
	const db = await getDb();
	const [row] = await db
		.select({
			value: environmentVariables.value,
			valueEncrypted: environmentVariables.valueEncrypted,
			valueIv: environmentVariables.valueIv,
			valueTag: environmentVariables.valueTag,
		})
		.from(environmentVariables)
		.where(eq(environmentVariables.id, id))
		.execute();
	if (!row) return null;
	if (row.valueEncrypted && row.valueIv && row.valueTag) {
		return decryptValue(row.valueEncrypted, row.valueIv, row.valueTag, config.envEncryptionKey);
	}
	return row.value ?? null;
};

export const updateEnvironmentVariable = async (
	id: string,
	value: string,
	scope?: EnvVarScope,
): Promise<EnvironmentVariable | null> => {
	const existing = await getEnvironmentVariableById(id);
	if (!existing) return null;
	const encrypted = encryptValue(value, config.envEncryptionKey);
	const db = await getDb();
	await db
		.update(environmentVariables)
		.set({
			value: "",
			valueEncrypted: encrypted.encrypted,
			valueIv: encrypted.iv,
			valueTag: encrypted.tag,
			...(scope ? { scope } : {}),
			updatedAt: now(),
		})
		.where(eq(environmentVariables.id, id))
		.execute();
	return getEnvironmentVariableById(id);
};

export const deleteEnvironmentVariable = async (id: string): Promise<boolean> => {
	const db = await getDb();
	const result = await db.delete(environmentVariables).where(eq(environmentVariables.id, id)).execute();
	return getRowsAffected(result) > 0;
};
