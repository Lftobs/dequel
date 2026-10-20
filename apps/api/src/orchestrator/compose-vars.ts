import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { findComposeFilePath } from "./compose";

export interface ComposeVarRef {
	key: string;
	mode: "plain" | "default" | "defaultUnset" | "required" | "requiredSet";
	defaultValue: string | null;
}

const DECLARED_RE = /(?<!\$)\$\{([A-Za-z_][A-Za-z0-9_]*)(:-|-|:\?|\?)([^}]*)\}/g;
const PLAIN_RE = /(?<!\$)\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const TEMPLATE_RE = /\{\{environment\.([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

const SEVERITY: Record<ComposeVarRef["mode"], number> = {
	plain: 0,
	defaultUnset: 1,
	default: 1,
	requiredSet: 2,
	required: 2,
};

export const scanComposeVariables = (text: string): ComposeVarRef[] => {
	const refs = new Map<string, ComposeVarRef>();
	for (const m of text.matchAll(DECLARED_RE)) {
		const key = m[1];
		const op = m[2];
		const rest = m[3] ?? "";
		const mode: ComposeVarRef["mode"] =
			op === ":-" ? "default" : op === "-" ? "defaultUnset" : op === ":?" ? "required" : "requiredSet";
		const fallback = mode === "default" || mode === "defaultUnset" ? rest : null;
		mergeRef(refs, { key, mode, defaultValue: fallback });
	}
	for (const m of text.matchAll(PLAIN_RE)) {
		mergeRef(refs, { key: m[1], mode: "plain", defaultValue: null });
	}
	return [...refs.values()];
};

const mergeRef = (refs: Map<string, ComposeVarRef>, next: ComposeVarRef): void => {
	const current = refs.get(next.key);
	if (!current || SEVERITY[next.mode] > SEVERITY[current.mode]) {
		refs.set(next.key, next);
		return;
	}
	if (SEVERITY[next.mode] === SEVERITY[current.mode] && !current.defaultValue && next.defaultValue) {
		current.defaultValue = next.defaultValue;
	}
};

export const resolveEnvironmentTemplates = (text: string): string =>
	text.replace(TEMPLATE_RE, (_match, key: string) => `\${${key}}`);

export const findMissingRequired = (refs: ComposeVarRef[], envMap: Record<string, string>): string[] => {
	const missing: string[] = [];
	for (const ref of refs) {
		const value = envMap[ref.key];
		if (ref.mode === "required" && (value === undefined || value === "")) missing.push(ref.key);
		if (ref.mode === "requiredSet" && value === undefined) missing.push(ref.key);
	}
	return missing;
};

export const parseComposeBuildServices = async (composeFile: string): Promise<string[]> => {
	try {
		const parsed = parseYaml(await readFile(composeFile, "utf8"));
		if (!parsed || typeof parsed !== "object" || !parsed.services) return [];
		return Object.entries(parsed.services)
			.filter(([, cfg]) => cfg && typeof cfg === "object" && "build" in (cfg as object))
			.map(([name]) => name);
	} catch {
		return [];
	}
};

export interface EnsureComposeEnvOptions {
	workspacePath: string;
	sourceDir?: string | null;
	projectId: string;
	environment?: string;
	providedRows: { key: string; value: string; scope: string }[];
	onLog: (line: string) => Promise<void>;
}

export const ensureComposeVariables = async (opts: EnsureComposeEnvOptions): Promise<Record<string, string>> => {
	const composeFile = findComposeFilePath(opts.workspacePath, opts.sourceDir);
	if (!composeFile) {
		throw new Error("No docker-compose.yml or compose file found in workspace.");
	}
	const original = await readFile(composeFile, "utf8");
	const text = resolveEnvironmentTemplates(original);
	if (text !== original) {
		await writeFile(composeFile, text, "utf8");
		await opts.onLog("[env] Rewrote {{environment.*}} templates in the compose file to ${VAR} syntax");
	}
	const refs = scanComposeVariables(text);
	const { seedComposeEnvVars } = await import("../db/repo/env-vars");
	const seeded = await seedComposeEnvVars(opts.projectId, opts.environment, refs);
	if (seeded.size > 0) {
		await opts.onLog(
			`[env] Registered ${seeded.size} compose-defined env var(s) from the compose file: ${[...seeded.keys()].join(", ")}`,
		);
	}
	const envMap: Record<string, string> = {};
	for (const row of opts.providedRows) envMap[row.key] = row.value;
	for (const [key, value] of seeded) {
		if (!(key in envMap)) envMap[key] = value;
	}
	const missing = findMissingRequired(refs, envMap);
	if (missing.length > 0) {
		const message =
			`Missing required env variables: ${missing.join(", ")} (declared with \${VAR:?} in the compose file). ` +
			"Set their values in the project environment tab, then redeploy.";
		throw new Error(message);
	}
	return envMap;
};
