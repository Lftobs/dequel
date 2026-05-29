import { spawn } from "node:child_process";
import { dockerBin } from "../utils/docker-bin";

export interface RailpackBuildResult {
	imageTag: string;
}

const buildTimeoutMs = Number(
	process.env.RAILPACK_BUILD_TIMEOUT_MS ??
		"600000",
);

const cleanBuildkitLine = (raw: string): string => {
	const line = raw.trim();
	if (!line) return "";

	// Strip trailing timestamps like "5.4s done" from DONE lines
	const noTime = line.replace(/\s+[\d.]+s?\s*(done|error|failed|canceled|DONE|ERROR|FAILED|CANCELED)?\s*$/i, "");
	if (!noTime) return "";

	// Strip all #N prefixes and whitespace
	const stripped = noTime.replace(/^#\d+\s*/i, "").trim();
	if (!stripped) return "";

	// Strip trailing time from DONE lines that are still there
	const clean = stripped.replace(/\s+[\d.]+s?\s*(done|error|failed|canceled|DONE|ERROR|FAILED|CANCELED)?\s*$/i, "").trim();
	if (!clean) return "";

	// Drop pure step-header lines like "#N" alone
	if (/^#\d+$/i.test(clean)) return "";

	return clean;
};

const spawnAsync = (
	cmd: string,
	args: string[],
	opts?: {
		env?: Record<string, string>;
		cwd?: string;
		timeoutMs?: number;
		onTimeout?: () => void;
		onLine?: (line: string) => void;
	},
): Promise<{
	stdout: string;
	stderr: string;
	code: number;
}> => {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: opts?.env ?? process.env,
			cwd: opts?.cwd,
		});
		let stdout = "";
		let stderr = "";
		let settled = false;

		const timeout =
			opts?.timeoutMs && opts.timeoutMs > 0
				? setTimeout(() => {
						if (settled) return;
						opts.onTimeout?.();
						child.kill("SIGTERM");
						setTimeout(() => {
							if (!settled) {
								child.kill("SIGKILL");
							}
						}, 5000);
						finish(
							undefined,
							new Error(
								`${cmd} timed out after ${opts.timeoutMs}ms`,
							),
						);
					}, opts.timeoutMs)
				: null;

		const finish = (
			result?: {
				stdout: string;
				stderr: string;
				code: number;
			},
			error?: Error,
		) => {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			if (error) {
				reject(error);
				return;
			}
			resolve(result!);
		};

		child.stdout.on("data", (chunk) => {
			const str = String(chunk);
			stdout += str;
			if (opts?.onLine) {
				for (const line of str
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)) {
					opts.onLine(line);
				}
			}
		});
		child.stderr.on("data", (chunk) => {
			const str = String(chunk);
			stderr += str;
			if (opts?.onLine) {
				for (const line of str
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)) {
					opts.onLine(line);
				}
			}
		});
		child.on("error", (error) =>
			finish(undefined, error),
		);
		child.on("close", (code) => {
			if (
				opts?.timeoutMs &&
				opts.timeoutMs > 0 &&
				code === 143
			) {
				finish(
					undefined,
					new Error(
						`${cmd} timed out after ${opts.timeoutMs}ms`,
					),
				);
				return;
			}
			finish({
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				code: code ?? 1,
			});
		});
	});
};

const ensureBuilder = async (): Promise<void> => {
	const ls = await spawnAsync(dockerBin, [
		"buildx",
		"ls",
	]);
	const hasBuilder = ls.stdout.includes(
		"railpack-builder",
	);

	if (!hasBuilder) {
		await spawnAsync(dockerBin, [
			"buildx",
			"create",
			"--name",
			"railpack-builder",
			"--driver",
			"docker-container",
			"--bootstrap",
		]);
		await spawnAsync(dockerBin, [
			"buildx",
			"use",
			"railpack-builder",
		]);
	}
};

export const buildWithRailpack = async (
	workspace: string,
	imageTag: string,
	onLog: (line: string) => Promise<void>,
	opts?: { cacheKey?: string },
): Promise<RailpackBuildResult> => {
	await onLog(
		`Starting Railpack CLI build for image: ${imageTag}`,
	);

	// Ensure builder exists (persists across builds)
	await ensureBuilder();

	const cacheKey =
		opts?.cacheKey ??
		imageTag
			.split(":")[0]
			.replace(/[^a-zA-Z0-9_-]/g, "-")
			.split("-")
			.slice(0, 2)
			.join("-"); // Fallback to 'dequel-default' or similar if imageTag starts with 'dequel-'

	const build = await spawnAsync(
		"railpack",
		[
			"build",
			"--name",
			imageTag,
			"--progress",
			"plain",
			"--cache-key",
			cacheKey,
			workspace,
		],
		{
			env: {
				...process.env,
				BUILDKIT_HOST:
					process.env.BUILDKIT_HOST,
			},
			timeoutMs:
				buildTimeoutMs > 0
					? buildTimeoutMs
					: undefined,
			onTimeout: () => {
				void onLog(
					`Railpack build timed out after ${Math.floor(buildTimeoutMs / 1000)}s`,
				);
			},
			onLine: (line) => {
				const cleaned = cleanBuildkitLine(line);
				if (cleaned) {
					void onLog(cleaned);
				}
			},
		},
	);

	if (build.code !== 0) {
		throw new Error(
			`railpack build failed: ${build.stderr || build.stdout}`,
		);
	}

	if (
		build.stdout.includes("No start command detected") ||
		build.stderr.includes("No start command detected")
	) {
		throw new Error(
			"Railpack build failed: No start command detected. Specify a start script in your package.json, a main field, or an index.ts/js file.",
		);
	}

	await onLog(
		`Railpack build completed: ${imageTag}`,
	);
	return { imageTag };
};
