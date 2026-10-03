import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildFileTools,
	buildFixTools,
	editFileAt,
	listFilesIn,
	readFileAt,
	searchInScope,
	writeFileAt,
	type ToolContext,
} from "../tools";

mock.restore();

let root = "";
let ctx: ToolContext;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "diag-tools-"));
	ctx = {
		roots: { dequel: join(root, "dequel"), project: join(root, "project") },
		progressPath: join(root, "progress.jsonl"),
	};
	await mkdir(join(root, "dequel", "apps/api/src"), { recursive: true });
	await writeFile(join(root, "dequel", "apps/api/src/pipeline.ts"), "export const run = () => { buildImage(); };\n");
	await writeFile(join(root, "dequel", "README.md"), "Dequel\n");
	await mkdir(join(root, "dequel", "node_modules"), { recursive: true });
	await writeFile(join(root, "dequel", "node_modules/blob.js"), "x".repeat(100));
	await mkdir(join(root, "project"), { recursive: true });
	await writeFile(join(root, "project", "Dockerfile"), "FROM node:20\nRUN npm ci\n");
});

afterAll(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

describe("sandbox file tools", () => {
	it("lists files while skipping dependency dirs", async () => {
		const paths = await listFilesIn(ctx, "dequel");
		expect(paths).toContain("apps/api/src/pipeline.ts");
		expect(paths).toContain("README.md");
		expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
		expect(await listFilesIn(ctx, "dequel", "apps/api/src")).toEqual(["apps/api/src/pipeline.ts"]);
	});

	it("reads capped file content", async () => {
		const out = await readFileAt(ctx, "project", "Dockerfile");
		expect(out).toContain("FROM node:20");
		await expect(readFileAt(ctx, "project", "missing.txt")).rejects.toThrow();
	});

	it("rejects paths escaping the roots", async () => {
		await expect(readFileAt(ctx, "dequel", "../../etc/passwd")).rejects.toThrow(/sandbox roots/);
		await expect(readFileAt(ctx, "dequel", "/srv/jobs/x/input.json")).rejects.toThrow(/sandbox roots/);
		await expect(readFileAt(ctx, "nope", "x")).rejects.toThrow();
		await expect(searchInScope(ctx, "dequel", "  ")).rejects.toThrow();
	});

	it("searches contents across the tree", async () => {
		const hits = await searchInScope(ctx, "dequel", "buildImage");
		expect(hits).toHaveLength(1);
		expect(hits[0]).toContain("apps/api/src/pipeline.ts:1:");
		expect(await searchInScope(ctx, "project", "zzz-no-match")).toEqual([]);
	});

	it("edits files with exact matches only", async () => {
		await writeFile(join(root, "project", "app.ts"), "const a = 1;\nconst b = 1;\n");
		await expect(editFileAt(ctx, "app.ts", "missing", "x")).rejects.toThrow(/not found/);
		await expect(editFileAt(ctx, "const", "x")).rejects.toThrow();
		await expect(editFileAt(ctx, "app.ts", "= 1;", "= 2;")).rejects.toThrow(/2 times/);
		await expect(editFileAt(ctx, "app.ts", "const a = 1;", "const a = 2;")).resolves.toContain("edited");
		await expect(editFileAt(ctx, "app.ts", "const a = 1;", "const a = 1;")).rejects.toThrow(/identical/);
		await expect(editFileAt(ctx, "app.ts", "", "x")).rejects.toThrow(/must not be empty/);
	});

	it("creates new files but never overwrites or escapes", async () => {
		await expect(writeFileAt(ctx, "new/nested/file.ts", "hello\n")).resolves.toContain("created");
		await expect(writeFileAt(ctx, "new/nested/file.ts", "again")).rejects.toThrow(/already exists/);
		await expect(writeFileAt(ctx, "../../evil.ts", "x")).rejects.toThrow(/sandbox roots/);
		await expect(writeFileAt(ctx, "big.ts", "x".repeat(100_001))).rejects.toThrow(/exceeds/);
	});

	it("returns handler errors as results instead of throwing", async () => {
		const tools = [...buildFileTools(ctx.roots, ctx.progressPath), ...buildFixTools(ctx.roots, ctx.progressPath)];
		const call = async (name: string, args: Record<string, unknown>) => {
			const tool = tools.find((t) => t.name === name) as unknown as { func: (a: unknown) => Promise<unknown> };
			return tool.func(args);
		};
		await expect(call("readFile", { scope: "dequel", path: "/srv/jobs/x/input.json" })).resolves.toMatch(
			/sandbox roots/,
		);
		await expect(call("listFiles", { scope: "dequel", prefix: "../../etc" })).resolves.toEqual([
			expect.stringMatching(/sandbox roots/),
		]);
		await expect(call("searchText", { scope: "dequel", query: "  " })).resolves.toEqual([
			expect.stringMatching(/Error:/),
		]);
		await expect(call("readFile", { scope: "nope", path: "x" })).resolves.toMatch(/Error:/);
	});
});
