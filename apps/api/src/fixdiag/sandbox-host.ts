import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { getDecryptedLlmKey } from "../db/repo/llm-keys";
import { config } from "../utils/config";
import type { DeploymentFacts, Investigation, TriageVerdict } from "./types";

const execFileAsync = promisify(execFile);

export const SANDBOX_CONTAINER = "dequel-diag-sandbox";
const RUNNER = "/runner/fixdiag/sandbox-runner/runner.js";

const short = (s: string, n = 500): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export const readLocalVersion = async (): Promise<string> => {
	const roots = [resolve(import.meta.dir, "../../../.."), "/app"];
	for (const root of roots) {
		try {
			const rev = await readFile(join(root, "VERSION"), "utf8").catch(() => null);
			const text = (typeof rev === "string" ? rev : (rev as unknown as { toString(): string })?.toString())?.trim();
			if (text) return text;
		} catch {}
	}
	const manifests = [resolve(import.meta.dir, "../../package.json"), "/app/package.json"];
	for (const manifest of manifests) {
		try {
			const raw = await readFile(manifest, "utf8").catch(() => null);
			const text = typeof raw === "string" ? raw : (raw as unknown as { toString(): string })?.toString();
			if (!text) continue;
			const version = (JSON.parse(text) as { version?: unknown }).version;
			if (typeof version === "string" && version.trim()) return version.trim();
		} catch {}
	}
	return "unknown";
};

const docker = async (args: string[], timeoutMs = 60_000): Promise<string> => {
	try {
		const out = await execFileAsync("docker", args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
		return String(out.stdout ?? "");
	} catch (err) {
		throw new Error(short(err instanceof Error ? err.message : String(err)));
	}
};

export const ensureSandbox = async (): Promise<void> => {
	const running = await docker(["inspect", "-f", "{{.State.Running}}", SANDBOX_CONTAINER], 15_000)
		.then((out) => out.trim() === "true")
		.catch(() => false);
	if (running) return;
	const exists = await docker(["inspect", "-f", "{{.Id}}", SANDBOX_CONTAINER], 15_000)
		.then((out) => out.trim().length > 0)
		.catch(() => false);
	if (exists) {
		await docker(["start", SANDBOX_CONTAINER], 60_000);
		return;
	}
	throw new Error("Diagnosis sandbox is not running (start the diagnose-sandbox service)");
};

export const syncDequelSource = async (version: string): Promise<{ rev: string; stale: boolean }> => {
	const tag = version.startsWith("v") ? version : `v${version}`;
	const hasRepo = await docker([
		"exec",
		SANDBOX_CONTAINER,
		"sh",
		"-c",
		"test -d /srv/dequel-src/.git && echo yes || echo no",
	]).then((out) => out.trim() === "yes");
	if (!hasRepo) {
		await docker(
			[
				"exec",
				SANDBOX_CONTAINER,
				"git",
				"clone",
				"--depth",
				"1",
				"--branch",
				tag,
				config.dequelSourceRepoUrl,
				"/srv/dequel-src",
			],
			180_000,
		).catch(() =>
			docker(
				["exec", SANDBOX_CONTAINER, "git", "clone", "--depth", "1", config.dequelSourceRepoUrl, "/srv/dequel-src"],
				180_000,
			),
		);
	}
	const fetched = await docker([
		"exec",
		SANDBOX_CONTAINER,
		"sh",
		"-c",
		`git -C /srv/dequel-src fetch --depth 1 origin ${tag} && git -C /srv/dequel-src checkout -q ${tag}`,
	])
		.then(() => true)
		.catch(() => false);
	const sha = await docker(
		["exec", SANDBOX_CONTAINER, "git", "-C", "/srv/dequel-src", "rev-parse", "--short", "HEAD"],
		15_000,
	)
		.then((out) => out.trim())
		.catch(() => "");
	const rev = sha ? `${tag} @ ${sha}` : tag;
	return { rev, stale: !fetched };
};

export const syncProjectSource = async (facts: DeploymentFacts): Promise<{ available: boolean }> => {
	await docker(["exec", SANDBOX_CONTAINER, "sh", "-c", "rm -rf /srv/project-src && mkdir -p /srv/project-src"], 30_000);
	if (facts.sourceType === "git") {
		const base = facts.branch ? ["--branch", facts.branch] : [];
		const cloned = await docker(
			["exec", SANDBOX_CONTAINER, "git", "clone", "--depth", "1", ...base, facts.sourceRef, "/srv/project-src"],
			180_000,
		)
			.then(() => true)
			.catch(() => false);
		if (!cloned) return { available: false };
		if (facts.commitSha) {
			await docker(
				[
					"exec",
					SANDBOX_CONTAINER,
					"git",
					"-C",
					"/srv/project-src",
					"fetch",
					"--depth",
					"1",
					"origin",
					facts.commitSha,
				],
				120_000,
			).catch(() => "");
			await docker(
				["exec", SANDBOX_CONTAINER, "git", "-C", "/srv/project-src", "checkout", "-q", facts.commitSha],
				30_000,
			).catch(() => "");
		}
		return { available: true };
	}
	if (facts.sourceType === "upload") {
		const dir = join(config.workspaceRoot, facts.deploymentId);
		const tmp = await mkdtemp(join(tmpdir(), "dequel-diag-cp-")).catch(() => null);
		if (!tmp) return { available: false };
		try {
			await docker(["cp", `${dir}/.`, `${SANDBOX_CONTAINER}:/srv/project-src/`], 120_000);
			return { available: true };
		} catch {
			return { available: false };
		} finally {
			await rm(tmp, { recursive: true, force: true }).catch(() => {});
		}
	}
	return { available: false };
};

export const clearProjectSource = async (): Promise<void> => {
	await docker(
		["exec", SANDBOX_CONTAINER, "sh", "-c", "rm -rf /srv/project-src && mkdir -p /srv/project-src"],
		30_000,
	).catch(() => {});
};

export const investigateInSandbox = async (input: {
	runId: string;
	provider: string;
	model: string;
	deployment: DeploymentFacts;
	failureReason: string;
	logText: string;
	verdict: TriageVerdict;
	dequelRev: string;
	dequelStale: boolean;
	projectAvailable: boolean;
	onProgress: (line: string) => void;
}): Promise<Investigation> => {
	const key = await getDecryptedLlmKey(input.provider);
	if (!key) throw new Error(`LLM provider "${input.provider}" is not configured`);
	await ensureSandbox();
	const taskBrief = [
		`Dequel platform source is mounted at scope "dequel" (${input.dequelRev}${input.dequelStale ? ", possibly stale" : ""}).`,
		input.projectAvailable
			? 'The deployed project\'s source is mounted at scope "project".'
			: "No project source is available; diagnose from the logs and the Dequel source only.",
		`Triage already read the logs (confidence ${input.verdict.confidence}, failing stage "${input.verdict.failingStage}") and flagged these signal lines: ${input.verdict.signalLines.slice(0, 6).join(" | ")}. Start from them instead of re-discovering the failure.`,
		"Use listFiles to discover layout, readFile for targeted reads, searchText to trace error strings.",
	].join(" ");
	const raw = await runAgentJob({
		jobDir: `/srv/jobs/${input.runId}`,
		input: {
			mode: "investigate",
			failureReason: input.failureReason,
			logText: input.logText,
			taskBrief,
			provider: input.provider,
			model: input.model,
			apiKey: key.apiKey,
			baseUrl: key.baseUrl,
			hasProjectSource: input.projectAvailable,
			dequelRev: input.dequelRev,
			dequelStale: input.dequelStale,
			deadlineMs: 9 * 60_000,
		},
		execTimeoutMs: 10 * 60_000,
		onProgress: input.onProgress,
	});
	return validateInvestigation(raw);
};

export interface FixAgentResult {
	patch: string;
	summary: string;
	changedFiles: string[];
}

export const runFixAgent = async (input: {
	runId: string;
	provider: string;
	model: string;
	fixBrief: string;
	dequelRev: string;
	dequelStale: boolean;
	onProgress: (line: string) => void;
}): Promise<FixAgentResult> => {
	const key = await getDecryptedLlmKey(input.provider);
	if (!key) throw new Error(`LLM provider "${input.provider}" is not configured`);
	await ensureSandbox();
	const raw = (await runAgentJob({
		jobDir: `/srv/jobs/fix-${input.runId}`,
		input: {
			mode: "fix",
			fixBrief: input.fixBrief,
			provider: input.provider,
			model: input.model,
			apiKey: key.apiKey,
			baseUrl: key.baseUrl,
			hasProjectSource: true,
			dequelRev: input.dequelRev,
			dequelStale: input.dequelStale,
			deadlineMs: 5.5 * 60_000,
		},
		execTimeoutMs: 6 * 60_000,
		onProgress: input.onProgress,
	})) as Record<string, unknown>;
	const summary = typeof raw.summary === "string" ? raw.summary : "";
	const changedFiles = Array.isArray(raw.changedFiles)
		? raw.changedFiles.filter((v): v is string => typeof v === "string").slice(0, 32)
		: [];
	const patch = await docker(["exec", SANDBOX_CONTAINER, "git", "-C", "/srv/project-src", "diff", "--no-color"], 30_000)
		.then((out) => out)
		.catch(() => "");
	if (!patch.trim()) throw new Error("agent made no changes to the project source");
	if (patch.length > 128_000) throw new Error("agent fix is too large to apply as a pull request");
	return { patch, summary, changedFiles };
};

const runAgentJob = async (opts: {
	jobDir: string;
	input: unknown;
	execTimeoutMs: number;
	onProgress: (line: string) => void;
}): Promise<unknown> => {
	const hostTmp = await mkdtemp(join(tmpdir(), "dequel-diag-job-"));
	try {
		await writeFile(join(hostTmp, "input.json"), JSON.stringify(opts.input));
		await docker(["exec", SANDBOX_CONTAINER, "mkdir", "-p", opts.jobDir], 15_000);
		await docker(["cp", join(hostTmp, "input.json"), `${SANDBOX_CONTAINER}:${opts.jobDir}/input.json`], 30_000);
		const deadline = Date.now() + opts.execTimeoutMs;
		let exited = false;
		const run = docker(["exec", SANDBOX_CONTAINER, "bun", RUNNER, `${opts.jobDir}/input.json`], opts.execTimeoutMs)
			.then(() => {
				exited = true;
			})
			.catch((err) => {
				exited = true;
				throw new Error(`sandbox agent failed: ${short(String(err))}`);
			});
		run.catch(() => {});
		let seen = 0;
		while (Date.now() < deadline && !exited) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			const lines = await docker(
				["exec", SANDBOX_CONTAINER, "sh", "-c", `cat ${opts.jobDir}/progress.jsonl 2>/dev/null || true`],
				15_000,
			)
				.then((out) => out.split("\n").filter(Boolean))
				.catch(() => [] as string[]);
			for (const line of lines.slice(seen)) opts.onProgress(line);
			seen = lines.length;
		}
		await run;
		const report = await docker(
			["exec", SANDBOX_CONTAINER, "sh", "-c", `cat ${opts.jobDir}/report.json 2>/dev/null || true`],
			15_000,
		)
			.then((out) => out.trim())
			.catch(() => "");
		if (!report) throw new Error("sandbox agent produced no report");
		return JSON.parse(report);
	} finally {
		await docker(["exec", SANDBOX_CONTAINER, "rm", "-rf", opts.jobDir], 30_000).catch(() => {});
		await rm(hostTmp, { recursive: true, force: true }).catch(() => {});
	}
};

export const validateInvestigation = (raw: unknown): Investigation => {
	const record = (raw ?? {}) as Record<string, unknown>;
	const cause = record.cause === "user-source" || record.cause === "dequel-source" ? record.cause : "unknown";
	const strings = (value: unknown, max = 8): string[] =>
		Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, max) : [];
	return {
		cause,
		culpritPaths: strings(record.culpritPaths),
		rationale: typeof record.rationale === "string" ? record.rationale : "",
		keyEvidence: strings(record.keyEvidence),
		dequelRev: typeof record.dequelRev === "string" ? record.dequelRev : "unknown",
		dequelStale: record.dequelStale === true,
	};
};
