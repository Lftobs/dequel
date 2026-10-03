import { getDeploymentById, getLogs } from "../db/repo/deployments";
import { getDecryptedLlmKey } from "../db/repo/llm-keys";
import { buildLlm, type DiagLlm } from "./llm";
import type { EvidenceBundle, LlmProvider, LogLine } from "./types";

export const tailLogs = (logs: LogLine[], maxLines = 400, maxChars = 24000): LogLine[] => {
	const tail = logs.slice(-maxLines);
	const out: LogLine[] = [];
	let chars = 0;
	for (let i = tail.length - 1; i >= 0; i--) {
		const len = tail[i].message.length;
		if (out.length > 0 && chars + len > maxChars) break;
		out.unshift(tail[i]);
		chars += len;
	}
	return out;
};

export const logTextOf = (logs: LogLine[]): string => {
	if (!logs.length) return "(no build logs were recorded for this deployment)";
	return logs.map((l) => `[${l.stage}] ${l.message}`).join("\n");
};

export const failureReasonOf = (reason: string | null): string =>
	reason?.trim() ? reason : "(no failure reason was recorded)";

export const collectFailureContext = async (deploymentId: string): Promise<EvidenceBundle> => {
	const dep = await getDeploymentById(deploymentId);
	if (!dep) throw new Error(`Deployment ${deploymentId} not found`);
	const logs = await getLogs(deploymentId);
	return {
		deployment: {
			deploymentId: dep.id,
			projectId: dep.projectId,
			sourceType: dep.sourceType,
			sourceRef: dep.sourceRef,
			branch: dep.branch,
			commitSha: dep.commitSha ?? "",
			failureReason: dep.failureReason,
		},
		logs: tailLogs(logs.map((l) => ({ sequence: l.sequence, stage: l.stage, message: l.message }))),
	};
};

export const resolveModel = async (provider: LlmProvider, model: string): Promise<DiagLlm> => {
	const rec = await getDecryptedLlmKey(provider);
	if (!rec) throw new Error(`LLM provider "${provider}" is not configured`);
	return buildLlm(provider, rec.apiKey, rec.baseUrl, model);
};
