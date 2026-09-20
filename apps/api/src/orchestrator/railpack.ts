import { spawn } from "node:child_process";
import type { Server } from "../types";
import { dockerBin } from "../utils/docker-bin";
import { generateDynamicRailpackJson } from "./railpack-config-utils";

export interface RailpackBuildResult {
	imageTag: string;
}

const buildTimeoutMs = Number(process.env.RAILPACK_BUILD_TIMEOUT_MS ?? "600000");

const cleanBuildkitLine = (raw: string): string => {
	const line = raw.trim();
	if (!line) return "";

	// Drop Docker layer download/upload/extract progress lines (sha256 digests with byte counts)
	if (/^(sha256:)?[0-9a-f]{40,}\s+[\d.]+\s*(B|KB|MB|GB)\s*\/\s*[\d.]+\s*(B|KB|MB|GB)/i.test(line)) return "";

	// Drop resolver/registry metadata lines
	if (/^(resolve|resolving)\s+(docker|image)/i.test(line)) return "";
	if (
		/^(sha256:)?[0-9a-f]{40,}\s*(done|already exists|pulling|download|extract|waiting|verifying|comparing|preparing)?$/i.test(
			line,
		)
	)
		return "";

	// Drop generic transfer/extract progress lines (e.g. "extracting sha256:...")
	if (
		/^(extracting|downloading|pushing|waiting|pulling fs layer|verifying checksum|download complete|pull complete|already exists)/i.test(
			line,
		)
	)
		return "";

	// Drop lines that are purely byte progress like "14.68MB / 48.50MB"
	if (/^[\d.]+\s*(B|KB|MB|GB)\s*\/\s*[\d.]+\s*(B|KB|MB|GB)\s*$/i.test(line)) return "";

	// Strip trailing timestamps like "5.4s done" from DONE lines
	const noTime = line.replace(/\s+[\d.]+s?\s*(done|error|failed|canceled|DONE|ERROR|FAILED|CANCELED)?\s*$/i, "");
	if (!noTime) return "";

	// Strip all #N prefixes and whitespace
	const stripped = noTime.replace(/^#\d+\s*/i, "").trim();
	if (!stripped) return "";

	// Strip trailing time from DONE lines that are still there
	const clean = stripped
		.replace(/\s+[\d.]+s?\s*(done|error|failed|canceled|DONE|ERROR|FAILED|CANCELED)?\s*$/i, "")
		.trim();
	if (!clean) return "";

	// Drop pure step-header lines like "#N" alone
	if (/^#\d+$/i.test(clean)) return "";

	// Drop sha256 lines that survived earlier filters (after #N stripping)
	if (/^(sha256:)?[0-9a-f]{40,}/i.test(clean)) return "";

	return clean;
};

export class CancelledError extends Error {
	constructor() {
		super("Deployment cancelled");
		this.name = "CancelledError";
	}
}

const spawnAsync = (
	cmd: string,
	args: string[],
	opts?: {
		env?: Record<string, string>;
		cwd?: string;
		timeoutMs?: number;
		onTimeout?: () => void;
		onLine?: (line: string) => void;
		signal?: AbortSignal;
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

		const onAbort = () => {
			if (settled) return;
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!settled) {
					child.kill("SIGKILL");
				}
			}, 5000);
			finish(undefined, new CancelledError());
		};

		if (opts?.signal) {
			if (opts.signal.aborted) {
				onAbort();
				return;
			}
			opts.signal.addEventListener("abort", onAbort, { once: true });
		}

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
						finish(undefined, new Error(`${cmd} timed out after ${opts.timeoutMs}ms`));
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
			if (opts?.signal) {
				opts.signal.removeEventListener("abort", onAbort);
			}
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
		child.on("error", (error) => finish(undefined, error));
		child.on("close", (code) => {
			if (opts?.timeoutMs && opts.timeoutMs > 0 && code === 143) {
				finish(undefined, new Error(`${cmd} timed out after ${opts.timeoutMs}ms`));
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

const ensureBuilder = async (dockerHost?: string): Promise<void> => {
	const hostArgs = dockerHost ? ["-H", dockerHost] : [];
	const ls = await spawnAsync(dockerBin, [...hostArgs, "buildx", "ls"]);
	const hasBuilder = ls.stdout.includes("railpack-builder");

	if (!hasBuilder) {
		await spawnAsync(dockerBin, [
			...hostArgs,
			"buildx",
			"create",
			"--name",
			"railpack-builder",
			"--driver",
			"docker-container",
			"--bootstrap",
		]);
		await spawnAsync(dockerBin, [...hostArgs, "buildx", "use", "railpack-builder"]);
	}
};

export const buildWithRailpack = async (
	workspace: string,
	imageTag: string,
	onLog: (line: string) => Promise<void>,
	opts?: {
		cacheKey?: string;
		sourceDir?: string | null;
		projectType?: string | null;
		buildCommand?: string | null;
		installCommand?: string | null;
		outputDir?: string | null;
		startCommand?: string | null;
		environmentVariables?: { key: string; value: string }[];
		signal?: AbortSignal;
		clearCache?: boolean;
		server?: Server | null;
	},
): Promise<RailpackBuildResult> => {
	await onLog(`Starting Railpack CLI build for image: ${imageTag}`);

	const dockerHost =
		opts?.server?.mode === "docker_tcp" ? `tcp://${opts.server.host}:${opts.server.port || 2376}` : undefined;

	await ensureBuilder(dockerHost);

	let cacheKey =
		opts?.cacheKey ??
		imageTag
			.split(":")[0]
			.replace(/-[0-9a-f]{8}$/i, "") // Strip unique deployment short ID suffix
			.replace(/[^a-zA-Z0-9_-]/g, "-");

	if (opts?.clearCache) {
		cacheKey = `${cacheKey}-clear-${Date.now()}`;
		await onLog(`Bypassing cache for clean build (cacheKey: ${cacheKey})`);
	}

	const cleanSourceDir = opts?.sourceDir ? opts.sourceDir.replace(/^\//, "") : null;
	await onLog(`Generating dynamic railpack.json for caching and monorepo resolution...`);
	await generateDynamicRailpackJson(
		workspace,
		cleanSourceDir,
		opts?.projectType ?? null,
		opts?.buildCommand ?? null,
		opts?.startCommand ?? null,
		onLog,
		opts?.installCommand ?? null,
		opts?.outputDir ?? null,
	);

	const args = [
		"build",
		"--name",
		imageTag,
		"--progress",
		"plain",
		"--cache-key",
		cacheKey,
		"--env",
		"CARGO_HTTP_MULTIPLEXING=false",
		"--env",
		"CARGO_HTTP_TIMEOUT=120",
		"--env",
		"CARGO_NET_GIT_FETCH_WITH_CLI=true",
		"--env",
		"RUSTUP_AUTO_SELF_UPDATE=off",
		"--env",
		"NPM_CONFIG_TIMEOUT=600000",
		"--env",
		"NPM_CONFIG_AUDIT=false",
		"--env",
		"NPM_CONFIG_FUND=false",
		"--env",
		"PNPM_CONFIG_TRUST_LOCKFILE=true",
		"--env",
		"NPM_CONFIG_MAXSOCKETS=4",
		"--env",
		"PNPM_CONFIG_NETWORK_CONCURRENCY=4",
		"--env",
		"PNPM_CONFIG_CHILD_CONCURRENCY=4",
		"--env",
		"PNPM_CONFIG_FETCH_RETRIES=10",
	];

	if (opts?.environmentVariables) {
		for (const env of opts.environmentVariables) {
			args.push("--env", `${env.key}=${env.value}`);
		}
	}

	args.push(workspace);

	const build = await spawnAsync("railpack", args, {
		env: {
			...process.env,
			BUILDKIT_HOST: process.env.BUILDKIT_HOST,
		},
		timeoutMs: buildTimeoutMs > 0 ? buildTimeoutMs : undefined,
		onTimeout: () => {
			void onLog(`Railpack build timed out after ${Math.floor(buildTimeoutMs / 1000)}s`);
		},
		onLine: (line) => {
			const cleaned = cleanBuildkitLine(line);
			if (cleaned) {
				void onLog(cleaned);
			}
		},
		signal: opts?.signal,
	});

	if (build.code !== 0) {
		throw new Error(`railpack build failed: ${build.stderr || build.stdout}`);
	}

	if (build.stdout.includes("No start command detected") || build.stderr.includes("No start command detected")) {
		throw new Error(
			"Railpack build failed: No start command detected. Specify a start script in your package.json, a main field, or an index.ts/js file.",
		);
	}

	await onLog(`Railpack build completed: ${imageTag}`);
	return { imageTag };
};
