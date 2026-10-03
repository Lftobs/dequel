import { appendFile, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { f, fn } from "@ax-llm/ax";
const MAX_LIST = 80;
const MAX_READ_BYTES = 2_400;
const MAX_WRITE_BYTES = 100_000;
const MAX_HITS = 10;
const MAX_SCAN_FILES = 500;
const MAX_SCAN_BYTES = 100_000;
const MAX_LIST_CHARS = 1_800;
const MAX_SEARCH_CHARS = 1_200;

const SKIP_DIRS = new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"__MACOSX",
	".venv",
	"target",
	".cache",
	"coverage",
]);

export interface SandboxRoots {
	dequel: string;
	project: string | null;
}

export interface ToolContext {
	roots: SandboxRoots;
	progressPath: string;
	readBytes?: number;
}

const capByChars = (items: string[], maxChars: number): string[] => {
	const out: string[] = [];
	let used = 0;
	for (const item of items) {
		if (used + item.length > maxChars) {
			out.push("…[truncated — narrow with prefix or a new query]");
			break;
		}
		out.push(item);
		used += item.length;
	}
	return out;
};

const toBytes = (data: unknown): Buffer | null => {
	if (Buffer.isBuffer(data)) return data;
	if (typeof data === "string") return Buffer.from(data, "utf8");
	if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
	return null;
};

const noteProgress = async (progressPath: string, message: string): Promise<void> => {
	await appendFile(progressPath, `${message}\n`).catch(() => {});
};

const errText = (err: unknown): string =>
	`Error: ${err instanceof Error ? err.message : String(err)} (adjust the call and try again)`;

const asTextResult =
	<A extends unknown[]>(handler: (...args: A) => Promise<string>) =>
	async (...args: A): Promise<string> => {
		try {
			return await handler(...args);
		} catch (err) {
			return errText(err);
		}
	};

const asListResult =
	<A extends unknown[]>(handler: (...args: A) => Promise<string[]>) =>
	async (...args: A): Promise<string[]> => {
		try {
			return await handler(...args);
		} catch (err) {
			return [errText(err)];
		}
	};

const baseFor = (roots: SandboxRoots, scope: string): string => {
	if (scope === "dequel") return roots.dequel;
	if (scope === "project") {
		if (!roots.project) throw new Error("project source is not available for this diagnosis (logs only)");
		return roots.project;
	}
	throw new Error(`unknown scope "${scope}" (use "dequel" or "project")`);
};

const confinePath = async (roots: SandboxRoots, scope: string, rel: string): Promise<string> => {
	const base = baseFor(roots, scope);
	const rootResolved = resolve(base);
	const abs = resolve(rootResolved, rel);
	if (abs !== rootResolved && !abs.startsWith(`${rootResolved}/`))
		throw new Error("path escapes the sandbox roots (use a repo-relative path, not an absolute path or ..)");
	const real = await realpath(abs).catch(() => null);
	if (!real || (real !== rootResolved && !real.startsWith(`${rootResolved}/`))) {
		throw new Error(`cannot access path: ${rel} (missing, or outside the ${scope} source root)`);
	}
	return abs;
};

const collectPaths = async (dir: string, rootResolved: string, out: string[]): Promise<void> => {
	if (out.length >= MAX_LIST) return;
	const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
	for (const entry of entries) {
		if (out.length >= MAX_LIST) return;
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			out.push(`${abs.slice(rootResolved.length + 1)}/`);
			await collectPaths(abs, rootResolved, out);
		} else if (entry.isFile()) {
			out.push(abs.slice(rootResolved.length + 1));
		}
	}
};

export const listFilesIn = async (ctx: ToolContext, scope: string, prefix?: string): Promise<string[]> => {
	const abs = await confinePath(ctx.roots, scope, prefix ?? "");
	const st = await stat(abs).catch(() => null);
	if (!st?.isDirectory()) throw new Error(`not a directory: ${prefix ?? ""}`);
	const out: string[] = [];
	await collectPaths(abs, resolve(baseFor(ctx.roots, scope)), out);
	const capped = capByChars(out, MAX_LIST_CHARS);
	await noteProgress(ctx.progressPath, `list ${scope}/${prefix ?? ""} (${out.length} paths, ${capped.length} shown)`);
	return capped;
};

export const readFileAt = async (ctx: ToolContext, scope: string, path: string): Promise<string> => {
	const abs = await confinePath(ctx.roots, scope, path);
	const st = await stat(abs).catch(() => null);
	if (!st?.isFile() || st.size > 1024 * 1024) throw new Error(`not a readable file: ${path}`);
	const buf = toBytes(await readFile(abs).catch(() => null));
	if (!buf || buf.length === 0) throw new Error(`cannot read file: ${path}`);
	if (buf.subarray(0, 8000).includes(0)) return `(binary file, skipped: ${path})`;
	const take = Math.min(buf.length, ctx.readBytes ?? MAX_READ_BYTES);
	await noteProgress(ctx.progressPath, `read ${scope}/${path} (${take} bytes)`);
	return `${buf.length > take ? "(truncated) " : ""}${path}\n---\n${buf.subarray(0, take).toString("utf8")}`;
};

export const searchInScope = async (
	ctx: ToolContext,
	scope: string,
	query: string,
	prefix?: string,
): Promise<string[]> => {
	if (!query.trim()) throw new Error("query must not be empty");
	const start = await confinePath(ctx.roots, scope, prefix ?? "");
	const rootResolved = resolve(baseFor(ctx.roots, scope));
	const hits: string[] = [];
	let scanned = 0;
	const visit = async (dir: string): Promise<void> => {
		if (hits.length >= MAX_HITS || scanned >= MAX_SCAN_FILES) return;
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			if (hits.length >= MAX_HITS || scanned >= MAX_SCAN_FILES) return;
			const abs = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) await visit(abs);
			} else if (entry.isFile()) {
				scanned++;
				const st = await stat(abs).catch(() => null);
				if (!st?.isFile() || st.size > 256 * 1024) continue;
				const buf = toBytes(await readFile(abs).catch(() => null));
				if (!buf || buf.length === 0 || buf.subarray(0, 8000).includes(0)) continue;
				const text = buf.subarray(0, MAX_SCAN_BYTES).toString("utf8");
				const needle = query.toLowerCase();
				const lines = text.split("\n");
				for (let i = 0; i < lines.length && hits.length < MAX_HITS; i++) {
					if (lines[i].toLowerCase().includes(needle)) {
						hits.push(`${abs.slice(rootResolved.length + 1)}:${i + 1}: ${lines[i].trim().slice(0, 120)}`);
					}
				}
			}
		}
	};
	await visit(start);
	await noteProgress(ctx.progressPath, `search ${scope} for "${query.slice(0, 60)}" (${hits.length} hits)`);
	return capByChars(hits, MAX_SEARCH_CHARS);
};

export const buildFileTools = (roots: SandboxRoots, progressPath: string, readBytes?: number) => {
	const ctx: ToolContext = { roots, progressPath, readBytes };
	const listFiles = fn("listFiles")
		.description(
			"List files under a source scope. Scope dequel is Dequel's own platform source; scope project is the deployed project's source. Call with a narrow prefix to discover layout before reading.",
		)
		.arg("scope", f.string('Source scope: "dequel" or "project"'))
		.arg("prefix", f.string("Optional subdirectory to list, e.g. apps/api/src/orchestrator").optional())
		.returns(f.string("Repo-relative paths, directories end with /").array())
		.handler(
			asListResult(async ({ scope, prefix }: { scope: string; prefix?: string }) => listFilesIn(ctx, scope, prefix)),
		)
		.build();

	const readFileTool = fn("readFile")
		.description(
			`Read one source file from the start, capped at ${((readBytes ?? MAX_READ_BYTES) / 1000).toFixed(1)}KB with a truncation flag. Prefer searchText to locate the exact region before reading.`,
		)
		.arg("scope", f.string('Source scope: "dequel" or "project"'))
		.arg("path", f.string("Repo-relative file path, e.g. apps/api/src/orchestrator/pipeline.ts"))
		.returns(f.string("File content prefixed with a header line"))
		.handler(asTextResult(async ({ scope, path }: { scope: string; path: string }) => readFileAt(ctx, scope, path)))
		.build();

	const searchText = fn("searchText")
		.description(
			"Search file contents for a fixed string (case-insensitive) under a scope. Use this to find error strings, function definitions, or config keys across the tree.",
		)
		.arg("scope", f.string('Source scope: "dequel" or "project"'))
		.arg("query", f.string("Fixed string to search for"))
		.arg("prefix", f.string("Optional subdirectory to search under").optional())
		.returns(f.string('Matching lines as "path:line: text"').array())
		.handler(
			asListResult(async ({ scope, query, prefix }: { scope: string; query: string; prefix?: string }) =>
				searchInScope(ctx, scope, query, prefix),
			),
		)
		.build();

	return [listFiles, readFileTool, searchText];
};

export const editFileAt = async (
	ctx: ToolContext,
	path: string,
	oldString: string,
	newString: string,
): Promise<string> => {
	if (!oldString) throw new Error("oldString must not be empty");
	if (newString === oldString) throw new Error("newString is identical to oldString");
	const abs = await confinePath(ctx.roots, "project", path);
	const st = await stat(abs).catch(() => null);
	if (!st?.isFile()) throw new Error(`not a file: ${path}`);
	const buf = toBytes(await readFile(abs).catch(() => null));
	if (!buf) throw new Error(`cannot read file: ${path}`);
	const content = buf.toString("utf8");
	const occurrences = content.split(oldString).length - 1;
	if (occurrences === 0) throw new Error(`oldString not found in ${path}`);
	if (occurrences > 1) throw new Error(`oldString matches ${occurrences} times in ${path}; include more context`);
	await writeFile(abs, content.replace(oldString, newString));
	await noteProgress(ctx.progressPath, `edit ${path}`);
	return `edited ${path}`;
};

export const writeFileAt = async (ctx: ToolContext, path: string, content: string): Promise<string> => {
	if (content.length > MAX_WRITE_BYTES) throw new Error(`content exceeds ${MAX_WRITE_BYTES} bytes`);
	if (!ctx.roots.project) throw new Error("project source is not available for this diagnosis (logs only)");
	const rootResolved = resolve(ctx.roots.project);
	const abs = resolve(rootResolved, path);
	if (abs !== rootResolved && !abs.startsWith(`${rootResolved}/`))
		throw new Error("path escapes the sandbox roots (use a repo-relative path, not an absolute path or ..)");
	const parent = dirname(abs);
	await mkdir(parent, { recursive: true });
	const realParent = await realpath(parent).catch(() => null);
	if (!realParent || (realParent !== rootResolved && !realParent.startsWith(`${rootResolved}/`))) {
		throw new Error("path escapes the sandbox roots (use a repo-relative path, not an absolute path or ..)");
	}
	const exists = await stat(abs).catch(() => null);
	if (exists) throw new Error(`${path} already exists; use editFile to modify it`);
	await mkdir(parent, { recursive: true });
	await writeFile(abs, content);
	await noteProgress(ctx.progressPath, `create ${path} (${content.length} bytes)`);
	return `created ${path}`;
};

export const buildFixTools = (roots: SandboxRoots, progressPath: string) => {
	const ctx: ToolContext = { roots, progressPath, readBytes: 8_000 };
	const reads = buildFileTools(roots, progressPath, 8_000);

	const editFile = fn("editFile")
		.description(
			"Replace one exact block of text in a project file. oldString must match exactly once. Use for surgical fixes; prefer this over rewriting whole files.",
		)
		.arg("path", f.string("Project-relative file path"))
		.arg("oldString", f.string("Exact text to replace (must occur exactly once)"))
		.arg("newString", f.string("Replacement text"))
		.returns(f.string("Confirmation"))
		.handler(
			asTextResult(async ({ path, oldString, newString }: { path: string; oldString: string; newString: string }) =>
				editFileAt(ctx, path, oldString, newString),
			),
		)
		.build();

	const createFile = fn("createFile")
		.description("Create a NEW project file. Fails if the file already exists. Keep new files small and necessary.")
		.arg("path", f.string("Project-relative file path"))
		.arg("content", f.string("Full file content"))
		.returns(f.string("Confirmation"))
		.handler(
			asTextResult(async ({ path, content }: { path: string; content: string }) => writeFileAt(ctx, path, content)),
		)
		.build();

	return [...reads, editFile, createFile];
};
