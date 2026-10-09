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

const run = async (cmd: string, args: string[], cwd?: string) => {
	const res = await safeSpawn(cmd, args, { cwd, timeoutMs: 120_000 });
	if (res.code !== 0) {
		throw new Error(`${cmd} exited with code ${res.code}: ${res.stderr || res.stdout}`);
	}
};

const isValidSha = (s: string) => /^[0-9a-f]{7,40}$/i.test(s);

export const prepareSourceWorkspace = async (
	deploymentId: string,
	gitUrl: string,
	branch?: string,
	commitSha?: string,
) => {
	const root = join(config.workspaceRoot, deploymentId);
	await rm(root, { recursive: true, force: true });
	await mkdir(root, { recursive: true });
	if (commitSha) {
		if (!isValidSha(commitSha)) {
			throw new Error(`Invalid commit SHA: ${commitSha}`);
		}
		await run("git", ["init"], root);
		await run("git", ["remote", "add", "origin", gitUrl], root);
		await run("git", ["fetch", "--depth", "1", "origin", commitSha], root);
		await run("git", ["checkout", "FETCH_HEAD"], root);
	} else {
		const args = ["clone", "--depth", "1"];
		if (branch) args.push("--branch", branch);
		args.push(gitUrl, root);
		await run("git", args);
	}
	return root;
};

export const prepareUploadWorkspace = async (deploymentId: string, archivePath: string) => {
	const root = join(config.workspaceRoot, deploymentId);
	await rm(root, { recursive: true, force: true });
	await mkdir(root, { recursive: true });

	if (archivePath.endsWith(".zip")) {
		await run("unzip", ["-q", archivePath, "-d", root]);
		return ensureSingleRoot(root);
	}

	if (archivePath.endsWith(".tar") || archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tgz")) {
		await run("tar", ["-xf", archivePath, "-C", root]);
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

export const getRemoteSha = async (gitUrl: string, branch?: string): Promise<string | null> => {
	try {
		const ref = branch ? `refs/heads/${branch}` : "HEAD";
		const res = await safeSpawn("git", ["ls-remote", gitUrl, ref], { timeoutMs: 15_000 });
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
