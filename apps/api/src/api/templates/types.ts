import { randomBytes } from "node:crypto";

export interface TemplateVar {
	key: string;
	label: string;
	description?: string;
	default?: string;
	secret?: boolean;
}

export interface DeployTemplate {
	key: string;
	name: string;
	description: string;
	category: string;
	docsUrl?: string;
	service: string;
	port: number;
	compose: string;
	vars: TemplateVar[];
}

export interface RenderedTemplate {
	compose: string;
	vars: { key: string; value: string; secret: boolean }[];
}

const generateSecret = (): string => randomBytes(24).toString("base64url");

export const renderCompose = (template: DeployTemplate, values: Record<string, string> = {}): RenderedTemplate => {
	const resolved: { key: string; value: string; secret: boolean }[] = [];
	let result = template.compose.trim();
	if (!result.startsWith("version:")) {
		result = `version: "3.8"\n\n${result}`;
	}

	for (const v of template.vars) {
		const provided = values[v.key]?.trim();
		const value = provided ? provided : v.default ? v.default : v.secret ? generateSecret() : undefined;
		if (value === undefined) {
			throw new Error(`Missing value for "${v.key}" (${v.label})`);
		}
		if (value.includes("\n") || value.includes("\r")) {
			throw new Error(`Value for "${v.key}" must not contain line breaks`);
		}
		result = result.split(`{${v.key}}`).join(`\${${v.key}}`);
		resolved.push({ key: v.key, value, secret: v.secret ?? false });
	}

	const leftover = result.match(/(?<!\$)\{[A-Z][A-Z0-9_]+\}/g);
	if (leftover) {
		throw new Error(`Template references unknown variables: ${leftover.join(", ")}`);
	}

	return { compose: result, vars: resolved };
};
