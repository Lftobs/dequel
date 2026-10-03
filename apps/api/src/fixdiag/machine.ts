import {
	createDiagRun,
	deleteDiagRun,
	findDiagRun,
	finishDiagRun,
	getDiagRun,
	getStagePayload,
	recordStageResult,
} from "../db/repo/diag-runs";
import { getDeploymentById } from "../db/repo/deployments";
import { getDecryptedLlmKey, LLM_PROVIDERS } from "../db/repo/llm-keys";
import { collectFailureContext, failureReasonOf, logTextOf, resolveModel } from "./context";
import { approveSlackPost } from "./actions";
import { createPrograms } from "./programs";
import { diagBus } from "./stream";
import type {
	DiagRun,
	DiagStageName,
	EvidenceBundle,
	Explanation,
	FixdiagPrograms,
	InvestigateFn,
	Investigation,
	LlmProvider,
	Localization,
	Proposal,
	TriageVerdict,
} from "./types";
import {
	clearProjectSource,
	investigateInSandbox,
	readLocalVersion,
	syncDequelSource,
	syncProjectSource,
} from "./sandbox-host";
import { parseGithubRepo } from "./repo-url";

export { parseGithubRepo };

const STAGES: DiagStageName[] = ["triage", "investigate", "explain", "propose"];
const activeDrives = new Set<string>();

const defaultInvestigator: InvestigateFn = async ({ run, deployment, logText, verdict, onProgress }) => {
	const version = await readLocalVersion();
	const { rev, stale } = await syncDequelSource(version);
	const project = await syncProjectSource(deployment);
	try {
		return await investigateInSandbox({
			runId: run.id,
			provider: run.provider,
			model: run.model,
			deployment,
			failureReason: failureReasonOf(deployment.failureReason),
			logText,
			verdict,
			dequelRev: rev,
			dequelStale: stale,
			projectAvailable: project.available,
			onProgress,
		});
	} finally {
		await clearProjectSource();
	}
};

const runStage = async (
	programs: FixdiagPrograms,
	investigate: InvestigateFn,
	stage: DiagStageName,
	evidence: EvidenceBundle,
	run: DiagRun,
	runId: string,
	emitProgress: (line: string) => void,
): Promise<unknown> => {
	switch (stage) {
		case "triage":
			return programs.triageLogs({
				failureReason: failureReasonOf(evidence.deployment.failureReason),
				logText: logTextOf(evidence.logs),
			});
		case "investigate":
			return investigate({
				run,
				deployment: evidence.deployment,
				logText: logTextOf(evidence.logs),
				verdict: (await getStagePayload(runId, "triage")) as TriageVerdict,
				onProgress: emitProgress,
			});
		case "explain": {
			const verdict = (await getStagePayload(runId, "triage")) as TriageVerdict;
			const investigation = (await getStagePayload(runId, "investigate")) as Investigation;
			const localization: Localization = {
				cause: investigation.cause,
				culpritPaths: investigation.culpritPaths,
				rationale: investigation.rationale,
			};
			return programs.explainFix({ verdict, localization });
		}
		case "propose": {
			const investigation = (await getStagePayload(runId, "investigate")) as Investigation;
			const localization: Localization = {
				cause: investigation.cause,
				culpritPaths: investigation.culpritPaths,
				rationale: investigation.rationale,
			};
			const explanation = (await getStagePayload(runId, "explain")) as Explanation;
			return programs.draftProposal({
				localization,
				explanation,
				repo: parseGithubRepo(evidence.deployment.sourceRef, evidence.deployment.branch),
			});
		}
	}
};

export const DiagRunMachine = {
	start: async (input: {
		deploymentId: string;
		provider: string;
		model: string;
	}): Promise<{ ok: true; run: DiagRun; created: boolean } | { ok: false; status: number; message: string }> => {
		if (!(LLM_PROVIDERS as readonly string[]).includes(input.provider)) {
			return { ok: false, status: 400, message: `provider must be one of: ${LLM_PROVIDERS.join(", ")}` };
		}
		if (!input.model?.trim()) return { ok: false, status: 400, message: "model is required" };
		const dep = await getDeploymentById(input.deploymentId);
		if (!dep) return { ok: false, status: 404, message: "Deployment not found" };
		if (dep.status !== "failed") {
			return { ok: false, status: 409, message: "Diagnosis is only available for failed deployments" };
		}
		const key = await getDecryptedLlmKey(input.provider);
		if (!key) return { ok: false, status: 400, message: `LLM provider "${input.provider}" is not configured` };
		const commitSha = dep.commitSha ?? "";
		const existing = await findDiagRun(input.deploymentId, commitSha);
		if (existing) {
			if (existing.status === "error") await deleteDiagRun(existing.id);
			else return { ok: true, run: existing, created: false };
		}
		const run = await createDiagRun({
			deploymentId: input.deploymentId,
			commitSha,
			provider: input.provider as LlmProvider,
			model: input.model.trim(),
		});
		return { ok: true, run, created: true };
	},

	drive: async (runId: string, programs?: FixdiagPrograms, investigate?: InvestigateFn): Promise<void> => {
		if (activeDrives.has(runId)) return;
		activeDrives.add(runId);
		try {
			const run = await getDiagRun(runId);
			if (!run || run.status !== "running") return;
			try {
				const llm = await resolveModel(run.provider, run.model);
				const progs = programs ?? createPrograms(llm);
				const investigateFn = investigate ?? defaultInvestigator;
				const evidence = await collectFailureContext(run.deploymentId);
				const startIdx = run.currentStage ? STAGES.indexOf(run.currentStage) + 1 : 0;
				for (let i = Math.max(0, startIdx); i < STAGES.length; i++) {
					const stage = STAGES[i];
					let payload: unknown;
					try {
						payload = await runStage(progs, investigateFn, stage, evidence, run, runId, (line) =>
							diagBus.emit(runId, { type: "token", runId, stage, delta: line }),
						);
					} catch (err) {
						throw new Error(`${stage} failed: ${err instanceof Error ? err.message : String(err)}`);
					}
					await recordStageResult(runId, stage, payload);
					diagBus.emit(runId, { type: "stage", runId, stage, payload });
				}
				const proposal = (await getStagePayload(runId, "propose")) as Proposal | null;
				const finalProposal: Proposal = proposal && proposal.cause ? proposal : { cause: "unknown" };
				await finishDiagRun(runId, "done", finalProposal.cause, finalProposal, null);
				if (finalProposal.cause === "dequel-source") {
					const posted = await approveSlackPost(runId, `auto-${runId}`).catch(() => null);
					if (!posted?.ok) console.log(`[Fixdiag] Slack auto-post skipped for ${runId}: ${posted?.message ?? "error"}`);
				}
				diagBus.emit(runId, { type: "done", runId });
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				await finishDiagRun(runId, "error", null, null, message).catch(() => {});
				diagBus.emit(runId, { type: "error", runId, message });
			}
		} finally {
			activeDrives.delete(runId);
		}
	},
};
