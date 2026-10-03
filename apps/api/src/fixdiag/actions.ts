import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { config } from "../utils/config";
import { claimDiagAction, completeDiagAction, failDiagAction, findCompletedAction } from "../db/repo/diag-actions";
import { getDiagRun, getStagePayload } from "../db/repo/diag-runs";
import { getDeploymentById } from "../db/repo/deployments";
import { getGithubTokenFromCookie } from "../db/repo/github-sessions";
import { getProjectById } from "../db/repo/projects";
import { parseGithubRepo } from "./repo-url";
import {
	clearProjectSource,
	ensureSandbox,
	readLocalVersion,
	runFixAgent,
	syncDequelSource,
	syncProjectSource,
} from "./sandbox-host";

const execFileAsync = promisify(execFile);

export type ActionResult = { ok: true; data: unknown } | { ok: false; status: number; message: string };

const short = (s: string, n = 500): string => (s.length > n ? `${s.slice(0, n)}…` : s);

const git = async (args: string[], cwd: string, token: string) => {
	const auth = Buffer.from(`x-access-token:${token}`).toString("base64");
	try {
		return await execFileAsync("git", args, {
			timeout: 120_000,
			cwd,
			maxBuffer: 4 * 1024 * 1024,
			env: {
				...process.env,
				GIT_TERMINAL_PROMPT: "0",
				GIT_CONFIG_COUNT: "1",
				GIT_CONFIG_KEY_0: "http.https://github.com/.extraHeader",
				GIT_CONFIG_VALUE_0: `Authorization: Basic ${auth}`,
			},
		});
	} catch (err) {
		const stderr = String((err as { stderr?: unknown }).stderr ?? "")
			.split(token)
			.join("***")
			.trim();
		throw new Error(`git ${args.join(" ")} failed: ${short(stderr || "command failed")}`);
	}
};

const githubFetch = async (token: string, path: string, init?: RequestInit) => {
	const res = await fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "dequel",
			"Content-Type": "application/json",
			...init?.headers,
		},
		signal: AbortSignal.timeout(30_000),
	});
	return res;
};

const validGithubToken = async (token: string): Promise<boolean> => {
	try {
		const res = await githubFetch(token, "/user");
		return res.ok;
	} catch {
		return false;
	}
};

export const approveFixPr = async (
	runId: string,
	key: string,
	cookie: string | null,
	opts?: { validateToken?: (token: string) => Promise<boolean> },
): Promise<ActionResult> => {
	if (!key.trim()) return { ok: false, status: 400, message: "idempotencyKey is required" };
	const trimmedKey = key.trim();
	const validate = opts?.validateToken ?? validGithubToken;
	const token = await getGithubTokenFromCookie(cookie);
	if (!token || !(await validate(token))) {
		return { ok: false, status: 401, message: "Connect GitHub first (Settings → GitHub Integration)" };
	}
	const run = await getDiagRun(runId);
	if (!run) return { ok: false, status: 404, message: "Diagnosis not found" };
	let claim;
	try {
		claim = await claimDiagAction(trimmedKey, runId, "pr");
	} catch {
		return { ok: false, status: 409, message: "Action key already used for a different intent" };
	}
	if (!claim.fresh) {
		if (claim.action.status === "done") return { ok: true, data: claim.action.result };
		return { ok: false, status: 409, message: "Action already in progress" };
	}
	const completed = await findCompletedAction(runId, "pr");
	if (completed) {
		await completeDiagAction(trimmedKey, completed.result);
		return { ok: true, data: completed.result };
	}
	const fail = async (status: number, message: string): Promise<ActionResult> => {
		await failDiagAction(trimmedKey, message);
		return { ok: false, status, message };
	};

	if (run.status !== "done") return fail(409, "Diagnosis is not complete yet");
	if (run.cause !== "user-source" || !run.report?.userFix) {
		return fail(409, "This diagnosis has no user-code fix to apply");
	}
	const fix = run.report.userFix;
	const dep = await getDeploymentById(run.deploymentId);
	if (!dep || dep.sourceType !== "git") return fail(409, "Fix PRs are only available for Git projects");
	if ((dep.commitSha ?? "") !== run.commitSha) {
		return fail(409, "The deployment has moved on since this diagnosis (stale)");
	}
	const repo = parseGithubRepo(dep.sourceRef, dep.branch);
	if (!repo) return fail(422, "Project source is not a GitHub repository");

	let patch: string;
	try {
		await ensureSandbox();
		const version = await readLocalVersion();
		const { rev, stale } = await syncDequelSource(version);
		const project = await syncProjectSource(
			{
				deploymentId: dep.id,
				projectId: dep.projectId,
				sourceType: dep.sourceType,
				sourceRef: dep.sourceRef,
				branch: dep.branch,
				commitSha: dep.commitSha ?? "",
				failureReason: dep.failureReason,
			},
			runId,
		);
		if (!project.available) {
			await clearProjectSource(runId);
			return fail(422, "Project source could not be pulled into the sandbox");
		}
		try {
			const investigation = (await getStagePayload(runId, "investigate")) as {
				culpritPaths?: unknown;
				rationale?: unknown;
			} | null;
			const explanation = (await getStagePayload(runId, "explain")) as {
				summary?: unknown;
				fixSteps?: unknown;
			} | null;
			const lines = [
				`Deployment failed: ${dep.failureReason ?? run.deploymentId}`,
				`Diagnosis: ${typeof explanation?.summary === "string" ? explanation.summary : ""}`,
				`Culprit files: ${Array.isArray(investigation?.culpritPaths) ? investigation.culpritPaths.filter((p): p is string => typeof p === "string").join(", ") : ""}`,
				`Fix steps: ${Array.isArray(explanation?.fixSteps) ? explanation.fixSteps.filter((s): s is string => typeof s === "string").join(" / ") : ""}`,
			];
			if (fix.suggestedDiff?.trim()) {
				lines.push(
					`Starting suggestion (verify against the files, do not apply blindly):\n${fix.suggestedDiff.slice(0, 8000)}`,
				);
			}
			const result = await runFixAgent({
				runId,
				provider: run.provider,
				model: run.model,
				fixBrief: lines.join("\n"),
				dequelRev: rev,
				dequelStale: stale,
				onProgress: () => {},
			});
			patch = result.patch;
		} finally {
			await clearProjectSource(runId);
		}
	} catch (err) {
		return fail(502, `Agent fix failed: ${short(err instanceof Error ? err.message : String(err))}`);
	}

	const branch = `dequel-fix/${run.id.slice(0, 8)}`;
	const tmp = await mkdtemp(join(tmpdir(), "dequel-fix-"));
	const repoDir = join(tmp, "repo");
	try {
		const remote = `https://github.com/${repo.owner}/${repo.repo}.git`;
		await git(["clone", "--depth", "1", "--branch", repo.base, remote, repoDir], tmpdir(), token);
		if (run.commitSha) {
			try {
				await git(["fetch", "--depth", "1", "origin", run.commitSha], repoDir, token);
				await git(["checkout", run.commitSha], repoDir, token);
			} catch {
				return fail(409, "The diagnosed commit is no longer available (stale)");
			}
		}
		const branchExists =
			(await git(["rev-parse", "--verify", `refs/heads/${branch}`], repoDir, token).catch(() => null)) !== null;
		await git(["checkout", ...(branchExists ? [branch] : ["-b", branch])], repoDir, token);
		const patchPath = join(tmp, "fix.diff");
		await writeFile(patchPath, patch);
		try {
			await execFileAsync("git", ["apply", "--check", patchPath], { timeout: 30_000, cwd: repoDir });
			await execFileAsync("git", ["apply", patchPath], { timeout: 30_000, cwd: repoDir });
		} catch (err) {
			const detail = short(err instanceof Error ? err.message : String(err));
			return fail(422, `Patch does not apply cleanly: ${detail}`);
		}
		await git(["add", "-A"], repoDir, token);
		await execFileAsync(
			"git",
			["-c", "user.name=Dequel", "-c", "user.email=dequel@localhost", "commit", "-m", fix.title, "-m", fix.body],
			{
				timeout: 30_000,
				cwd: repoDir,
			},
		);
		try {
			await git(["push", "origin", branch], repoDir, token);
		} catch (err) {
			return fail(422, `Push failed: ${short(err instanceof Error ? err.message : String(err))}`);
		}
		const prRes = await githubFetch(token, `/repos/${repo.owner}/${repo.repo}/pulls`, {
			method: "POST",
			body: JSON.stringify({ title: fix.title, body: fix.body, head: branch, base: repo.base }),
		});
		if (prRes.status === 201) {
			const pr = (await prRes.json()) as { html_url?: string };
			const result = { prUrl: pr.html_url ?? "" };
			await completeDiagAction(trimmedKey, result);
			return { ok: true, data: result };
		}
		const prBody = short(await prRes.text().catch(() => ""));
		if (prRes.status === 422 && prBody.includes("already exists")) {
			const existing = await githubFetch(
				token,
				`/repos/${repo.owner}/${repo.repo}/pulls?head=${repo.owner}:${branch}&state=open`,
			);
			const list = (await existing.json().catch(() => [])) as { html_url?: string }[];
			if (list[0]?.html_url) {
				const result = { prUrl: list[0].html_url };
				await completeDiagAction(trimmedKey, result);
				return { ok: true, data: result };
			}
		}
		return fail(502, `GitHub rejected the pull request: ${prBody || prRes.status}`);
	} catch (err) {
		return fail(500, short(err instanceof Error ? err.message : String(err)));
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

export const approveSlackPost = async (runId: string, key: string): Promise<ActionResult> => {
	if (!key.trim()) return { ok: false, status: 400, message: "idempotencyKey is required" };
	const trimmedKey = key.trim();
	const run = await getDiagRun(runId);
	if (!run) return { ok: false, status: 404, message: "Diagnosis not found" };
	let claim;
	try {
		claim = await claimDiagAction(trimmedKey, runId, "slack");
	} catch {
		return { ok: false, status: 409, message: "Action key already used for a different intent" };
	}
	if (!claim.fresh) {
		if (claim.action.status === "done") return { ok: true, data: claim.action.result };
		return { ok: false, status: 409, message: "Action already in progress" };
	}
	const completed = await findCompletedAction(runId, "slack");
	if (completed) {
		await completeDiagAction(trimmedKey, completed.result);
		return { ok: true, data: completed.result };
	}
	const fail = async (status: number, message: string): Promise<ActionResult> => {
		await failDiagAction(trimmedKey, message);
		return { ok: false, status, message };
	};

	if (run.status !== "done") return fail(409, "Diagnosis is not complete yet");
	if (run.cause !== "dequel-source" || !run.report?.dequelReport) {
		return fail(409, "This diagnosis has no Dequel report to post");
	}
	if (!config.dequelSlackWebhookUrl) return fail(409, "Dequel Slack is not configured");

	const report = run.report.dequelReport;
	const dep = await getDeploymentById(run.deploymentId);
	const project = dep?.projectId ? await getProjectById(dep.projectId).catch(() => null) : null;
	const investigation = (await getStagePayload(runId, "investigate")) as {
		dequelRev?: unknown;
		dequelStale?: unknown;
	} | null;
	const version =
		typeof investigation?.dequelRev === "string" && investigation.dequelRev
			? investigation.dequelRev + (investigation.dequelStale === true ? " (possibly stale)" : "")
			: "unknown";
	const payload = {
		text: `Dequel diagnosis: ${project?.name ?? run.deploymentId}`,
		blocks: [
			{ type: "header", text: { type: "plain_text", text: `Dequel diagnosis: ${project?.name ?? "unknown project"}` } },
			{ type: "section", text: { type: "mrkdwn", text: `*Problem*\n${report.problem}` } },
			{ type: "section", text: { type: "mrkdwn", text: `*Dequel version*\n${version}` } },
			{ type: "section", text: { type: "mrkdwn", text: `*Root cause*\n${report.cause}` } },
			{ type: "section", text: { type: "mrkdwn", text: `*Proposed fix*\n${report.proposedFix}` } },
			{
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: `Deployment ${run.deploymentId.slice(0, 8)} · diagnosed with ${run.provider}/${run.model}`,
					},
				],
			},
		],
	};
	try {
		const res = await fetch(config.dequelSlackWebhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			redirect: "manual",
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) return fail(502, `Slack webhook returned ${res.status}`);
	} catch (err) {
		return fail(502, short(err instanceof Error ? err.message : String(err)));
	}
	const result = { posted: true, channel: config.dequelSlackChannel || undefined };
	await completeDiagAction(trimmedKey, result);
	return { ok: true, data: result };
};
