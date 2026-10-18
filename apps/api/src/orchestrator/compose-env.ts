const yamlScalar = (value: string): string => JSON.stringify(value).split("$").join("$$");

export const buildComposeEnvOverrideYaml = (serviceNames: string[], envVars: Record<string, string>): string => {
	const keys = Object.keys(envVars);
	if (serviceNames.length === 0 || keys.length === 0) return "";
	const lines = ["services:"];
	for (const serviceName of serviceNames) {
		if (!serviceName.trim()) continue;
		lines.push(`  ${serviceName}:`);
		lines.push("    environment:");
		for (const key of keys) {
			lines.push(`      ${key}: ${yamlScalar(envVars[key])}`);
		}
	}
	return `${lines.join("\n")}\n`;
};
