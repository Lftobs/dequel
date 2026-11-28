const yamlScalar = (value: string): string => JSON.stringify(value).split("$").join("$$");

export interface ComposeEnvRow {
	key: string;
	value: string;
	scope?: string;
}

export const splitEnvByScope = (rows: ComposeEnvRow[]): { runtime: [string, string][]; build: [string, string][] } => {
	const runtime: [string, string][] = [];
	const build: [string, string][] = [];
	for (const row of rows) {
		if (row.scope !== "build") runtime.push([row.key, row.value]);
		if (row.scope !== "runtime") build.push([row.key, row.value]);
	}
	return { runtime, build };
};

export const buildComposeScopedOverrideYaml = (
	serviceNames: string[],
	buildServiceNames: string[],
	rows: ComposeEnvRow[],
): string => {
	const { runtime, build } = splitEnvByScope(rows);
	if (serviceNames.length === 0 || (runtime.length === 0 && build.length === 0)) return "";
	const buildSet = new Set(buildServiceNames);
	const lines = ["services:"];
	let emitted = 0;
	for (const serviceName of serviceNames) {
		if (!serviceName.trim()) continue;
		const isBuildService = buildSet.has(serviceName);
		if (!isBuildService && runtime.length === 0) continue;
		emitted += 1;
		lines.push(`  ${serviceName}:`);
		if (runtime.length > 0) {
			lines.push("    environment:");
			for (const [key, value] of runtime) {
				lines.push(`      ${key}: ${yamlScalar(value)}`);
			}
		}
		if (isBuildService && build.length > 0) {
			lines.push("    build:");
			lines.push("      args:");
			for (const [key, value] of build) {
				lines.push(`        ${key}: ${yamlScalar(value)}`);
			}
		}
	}
	return emitted > 0 ? `${lines.join("\n")}\n` : "";
};
