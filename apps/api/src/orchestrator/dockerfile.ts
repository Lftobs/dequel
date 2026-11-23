import { join } from "node:path";
import type { Server } from "../types";
import { dockerBin } from "../utils/docker-bin";
import { getDockerTargetArgs } from "../utils/docker-run";
import { cleanBuildkitLine, spawnAsync } from "./railpack";

const buildTimeoutMs = Number(
	process.env.DOCKERFILE_BUILD_TIMEOUT_MS ?? process.env.RAILPACK_BUILD_TIMEOUT_MS ?? "1200000",
);

export interface DockerfileBuildOpts {
	dockerfilePath?: string | null;
	target?: string | null;
	buildArgs?: { key: string; value: string }[];
	sourceDir?: string | null;
	server?: Server | null;
	signal?: AbortSignal;
	clearCache?: boolean;
}

export interface DockerfileArgsOpts {
	imageTag: string;
	dockerfilePath?: string | null;
	target?: string | null;
	buildArgs?: { key: string; value: string }[];
	clearCache?: boolean;
	targetArgs?: string[];
}

export const buildDockerfileArgs = (opts: DockerfileArgsOpts): string[] => {
	const dockerfilePath = opts.dockerfilePath?.trim() || "Dockerfile";
	const args = [...(opts.targetArgs ?? []), "build", "-t", opts.imageTag, "-f", dockerfilePath, "--progress", "plain"];
	if (opts.target) args.push("--target", opts.target);
	for (const arg of opts.buildArgs ?? []) {
		args.push("--build-arg", `${arg.key}=${arg.value}`);
	}
	if (opts.clearCache) args.push("--no-cache");
	args.push(".");
	return args;
};

export const buildWithDockerfile = async (
	workspace: string,
	imageTag: string,
	onLog: (line: string) => Promise<void>,
	opts: DockerfileBuildOpts = {},
): Promise<{ imageTag: string }> => {
	const contextDir = opts.sourceDir ? join(workspace, opts.sourceDir.replace(/^\//, "")) : workspace;
	const dockerfilePath = opts.dockerfilePath?.trim() || "Dockerfile";
	await onLog(`Building Dockerfile image ${imageTag} from ${dockerfilePath}`);

	const args = buildDockerfileArgs({
		imageTag,
		dockerfilePath,
		target: opts.target,
		buildArgs: opts.buildArgs,
		clearCache: opts.clearCache,
		targetArgs: getDockerTargetArgs(opts.server),
	});
	if (opts.clearCache) await onLog("Building without Docker layer cache");

	const result = await spawnAsync(dockerBin, args, {
		cwd: contextDir,
		timeoutMs: buildTimeoutMs > 0 ? buildTimeoutMs : undefined,
		onTimeout: () => {
			void onLog(`Dockerfile build timed out after ${Math.floor(buildTimeoutMs / 1000)}s`);
		},
		onLine: (line) => {
			const cleaned = cleanBuildkitLine(line);
			if (cleaned) void onLog(cleaned);
		},
		signal: opts.signal,
	});

	if (result.code !== 0) {
		throw new Error(`Dockerfile build failed: ${result.stderr || result.stdout}`);
	}
	await onLog(`Dockerfile build completed: ${imageTag}`);
	return { imageTag };
};
