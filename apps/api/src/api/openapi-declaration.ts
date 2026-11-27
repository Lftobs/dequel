import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fromTypes } from "@elysia/openapi";

type TypeReferences = ReturnType<ReturnType<typeof fromTypes>>;

const projectRoot = join(import.meta.dir, "..", "..");
const entrySource = join(projectRoot, "src", "app.ts");
const tscLauncher = join(projectRoot, "node_modules", "typescript", "bin", "tsc");

const cacheRoot = existsSync("/app/data")
	? "/app/data/openapi"
	: join(tmpdir(), "dequl-openapi", projectRoot.replace(/[^a-zA-Z0-9]/g, "_"));

const declarationPath = join(cacheRoot, "src", "app.d.ts");
const referencesPath = join(cacheRoot, "references.json");

const newestSourceMtime = (dir: string): number => {
	let newest = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			newest = Math.max(newest, newestSourceMtime(path));
		} else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
			newest = Math.max(newest, statSync(path).mtimeMs);
		}
	}
	return newest;
};

const sourceMtime = () => newestSourceMtime(join(projectRoot, "src"));

const isFresh = (path: string, mtime: number) => existsSync(path) && statSync(path).mtimeMs >= mtime;

const generateDeclaration = (mtime: number): string | undefined => {
	mkdirSync(cacheRoot, { recursive: true });
	const tsconfigPath = join(cacheRoot, "tsconfig.json");
	writeFileSync(
		tsconfigPath,
		JSON.stringify(
			{
				extends: join(projectRoot, "tsconfig.json"),
				compilerOptions: {
					target: "ESNext",
					module: "ESNext",
					moduleResolution: "bundler",
					lib: ["ESNext", "DOM"],
					noEmit: false,
					declaration: true,
					emitDeclarationOnly: true,
					skipLibCheck: true,
					skipDefaultLibCheck: true,
					incremental: true,
					tsBuildInfoFile: join(cacheRoot, "tsconfig.tsbuildinfo"),
					rootDir: projectRoot,
					outDir: cacheRoot,
				},
				include: [entrySource],
			},
			null,
			2,
		),
	);
	const result = Bun.spawnSync([process.execPath, tscLauncher, "-p", tsconfigPath], {
		cwd: projectRoot,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	if (!isFresh(declarationPath, mtime)) {
		console.warn("[OpenAPI] Type declaration generation failed");
		const stderr = Buffer.from(result.stderr ?? [])
			.toString()
			.trim();
		if (stderr) console.warn(stderr.slice(0, 2000));
		return undefined;
	}
	return declarationPath;
};

export const ensureAppDeclaration = (): string | undefined => {
	const mtime = sourceMtime();
	if (isFresh(declarationPath, mtime)) return declarationPath;
	return generateDeclaration(mtime);
};

export const loadTypeReferences = (): TypeReferences | undefined => {
	const mtime = sourceMtime();
	if (isFresh(referencesPath, mtime)) {
		try {
			return JSON.parse(readFileSync(referencesPath, "utf8")) as TypeReferences;
		} catch {
			// fall through to regeneration
		}
	}

	const declaration = ensureAppDeclaration();
	if (!declaration) return undefined;

	const references = fromTypes(declaration, {
		projectRoot,
		instanceName: "app",
		tsconfigPath: "tsconfig.json",
	})();
	if (references) {
		mkdirSync(cacheRoot, { recursive: true });
		writeFileSync(referencesPath, JSON.stringify(references));
	}
	return references;
};
