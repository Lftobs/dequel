import { mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { config } from "../utils/config";
import { safeSpawn } from "../utils/process-exec";

const ensureSingleRoot = async (root: string): Promise<string> => {
	const entries = await readdir(root, { withFileTypes: true });
	const valid = entries.filter((e) => !e.name.startsWith(".") && e.name !== "__MACOSX");

	if (valid.length === 1 && valid[0].isDirectory()) {
		return join(root, valid[0].name);
	}
	return root;
};

const run = async (cmd: string, args: string[], cwd?: string, env?: Record<string, string>) => {
	const res = await safeSpawn(cmd, args, { cwd, timeoutMs: 120_000, env });
	if (res.code !== 0) {
		throw new Error(`${cmd} exited with code ${res.code}: ${res.stderr || res.stdout}`);
	}
};

const isValidSha = (s: string) => /^[0-9a-f]{7,40}$/i.test(s);

export const isGithubHttpsUrl = (gitUrl: string) => /^https:\/\/github\.com\//i.test(gitUrl.trim());

export const redactGitUrl = (gitUrl: string) => gitUrl.replace(/^(https:\/\/)[^/@]+@([^/]+)/i, "$1$2");

export const buildAuthenticatedGitUrl = (gitUrl: string, token?: string | null) => {
	if (!token) return gitUrl;
	const trimmed = gitUrl.trim();
	if (!isGithubHttpsUrl(trimmed)) return gitUrl;
	if (trimmed.includes("@")) return gitUrl;
	return trimmed.replace(/^https:\/\/github\.com\//i, `https://x-access-token:${token}@github.com/`);
};

export const resolveProjectGitUrl = async (projectId: string | null | undefined, gitUrl: string): Promise<string> => {
	if (!projectId || !isGithubHttpsUrl(gitUrl)) return gitUrl;
	try {
		const { getProjectGithubToken } = await import("../db/repo/projects");
		return buildAuthenticatedGitUrl(gitUrl, await getProjectGithubToken(projectId));
	} catch {
		return gitUrl;
	}
};

const shq = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export const buildGitAuthEnv = (authedUrl: string): { env: Record<string, string>; cleanUrl: string } | null => {
	const cleanUrl = redactGitUrl(authedUrl);
	if (cleanUrl === authedUrl) return null;
	if (!isGithubHttpsUrl(cleanUrl)) return null;
	return {
		env: {
			GIT_CONFIG_COUNT: "1",
			GIT_CONFIG_KEY_0: `url.${authedUrl}.insteadOf`,
			GIT_CONFIG_VALUE_0: cleanUrl,
		},
		cleanUrl,
	};
};

export const gitAuthScriptLines = (authedUrl: string): string[] => {
	const auth = buildGitAuthEnv(authedUrl);
	if (!auth) return [];
	return [
		'export GIT_CONFIG_COUNT="1"',
		`export GIT_CONFIG_KEY_0=${shq(`url.${authedUrl}.insteadOf`)}`,
		`export GIT_CONFIG_VALUE_0=${shq(auth.cleanUrl)}`,
	];
};

export const prepareSourceWorkspace = async (
	deploymentId: string,
	gitUrl: string,
	branch?: string,
	commitSha?: string,
	token?: string | null,
) => {
	const root = join(config.workspaceRoot, deploymentId);
	await rm(root, { recursive: true, force: true });
	await mkdir(root, { recursive: true });
	const authedUrl = buildAuthenticatedGitUrl(gitUrl, token);
	const auth = buildGitAuthEnv(authedUrl);
	const remoteUrl = auth?.cleanUrl ?? authedUrl;
	if (commitSha) {
		if (!isValidSha(commitSha)) {
			throw new Error(`Invalid commit SHA: ${commitSha}`);
		}
		await run("git", ["init"], root, auth?.env);
		await run("git", ["remote", "add", "origin", remoteUrl], root, auth?.env);
		await run("git", ["fetch", "--depth", "1", "origin", commitSha], root, auth?.env);
		await run("git", ["checkout", "FETCH_HEAD"], root);
	} else {
		const args = ["clone", "--depth", "1"];
		if (branch) args.push("--branch", branch);
		args.push(remoteUrl, root);
		await run("git", args, undefined, auth?.env);
	}
	return root;
};

export const prepareUploadWorkspace = async (deploymentId: string, archivePath: string, projectId?: string | null) => {
	const root = join(config.workspaceRoot, deploymentId);
	await rm(root, { recursive: true, force: true });
	await mkdir(root, { recursive: true });

	let resolvedArchive = archivePath;
	const { existsSync } = await import("node:fs");
	const { basename } = await import("node:path");
	if (!existsSync(resolvedArchive)) {
		const inUploads = join(config.workspaceRoot, "uploads", basename(archivePath));
		if (existsSync(inUploads)) {
			resolvedArchive = inUploads;
		} else if (projectId) {
			try {
				const { getProjectById } = await import("../db/repo");
				const proj = await getProjectById(projectId);
				if (proj) {
					const { ensureValidComposeArchive } = await import("../api/projects/compose");
					resolvedArchive = await ensureValidComposeArchive(proj, archivePath);
				}
			} catch (error) {
				console.warn(`[Source] Could not recover compose archive for project ${projectId}:`, error);
			}
		}
	}

	if (resolvedArchive.endsWith(".zip")) {
		await run("unzip", ["-q", resolvedArchive, "-d", root]);
		return ensureSingleRoot(root);
	}

	if (resolvedArchive.endsWith(".tar") || resolvedArchive.endsWith(".tar.gz") || resolvedArchive.endsWith(".tgz")) {
		await run("tar", ["-xf", resolvedArchive, "-C", root]);
		return ensureSingleRoot(root);
	}

	throw new Error("Unsupported archive format. Use .zip, .tar, .tar.gz, or .tgz");
};

export const getHeadSha = async (repoPath: string): Promise<string | null> => {
	try {
		const res = await safeSpawn("git", ["rev-parse", "HEAD"], { cwd: repoPath, timeoutMs: 15_000 });
		return res.code === 0 ? res.stdout.trim() || null : null;
	} catch {
		return null;
	}
};

export const getRemoteSha = async (gitUrl: string, branch?: string, token?: string | null): Promise<string | null> => {
	try {
		const ref = branch ? `refs/heads/${branch}` : "HEAD";
		const res = await safeSpawn("git", ["ls-remote", buildAuthenticatedGitUrl(gitUrl, token), ref], {
			timeoutMs: 15_000,
		});
		if (res.code !== 0) return null;
		const match = res.stdout.trim().split(/\s+/)[0];
		return match || null;
	} catch {
		return null;
	}
};

export const cleanupWorkspace = async (workspacePath: string) => {
	await rm(workspacePath, { recursive: true, force: true });

	const parent = dirname(workspacePath);
	const rel = relative(config.workspaceRoot, parent);
	if (rel && !rel.startsWith("..") && !rel.includes("/")) {
		await rm(parent, { recursive: true, force: true });
	}
};
