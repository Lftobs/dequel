export type LlmProvider = "openai" | "anthropic" | "gemini" | "groq" | "ollama" | "custom";

export type DiagStageName = "triage" | "investigate" | "explain" | "propose";

export type CauseKind = "user-source" | "dequel-source" | "unknown";

export type TriageConfidence = "low" | "medium" | "high";

export type DiagStatus = "running" | "done" | "error";

export interface LogLine {
	sequence: number;
	stage: string;
	message: string;
}

export interface DeploymentFacts {
	deploymentId: string;
	projectId: string | null;
	sourceType: string;
	sourceRef: string;
	branch: string | null;
	commitSha: string;
	failureReason: string | null;
}

export interface EvidenceBundle {
	deployment: DeploymentFacts;
	logs: LogLine[];
}

export interface TriageVerdict {
	failingStage: string;
	signalLines: string[];
	confidence: TriageConfidence;
}

export interface Localization {
	cause: CauseKind;
	culpritPaths: string[];
	rationale: string;
}

export interface Explanation {
	summary: string;
	fixSteps: string[];
	patchHint: string | null;
}

export interface UserFix {
	title: string;
	body: string;
	suggestedDiff: string | null;
}

export interface DequelReport {
	problem: string;
	cause: string;
	proposedFix: string;
}

export interface Proposal {
	cause: CauseKind;
	userFix?: UserFix;
	dequelReport?: DequelReport;
}

export interface DiagRun {
	id: string;
	deploymentId: string;
	commitSha: string;
	provider: LlmProvider;
	model: string;
	status: DiagStatus;
	currentStage: DiagStageName | null;
	cause: CauseKind | null;
	report: Proposal | null;
	error: string | null;
	createdAt: string;
}

export type StageEvent =
	| { type: "stage"; runId: string; stage: DiagStageName; payload: unknown }
	| { type: "token"; runId: string; stage: DiagStageName; delta: string }
	| { type: "done"; runId: string }
	| { type: "error"; runId: string; message: string };

export interface TriageInput {
	failureReason: string | null;
	logText: string;
}

export interface ExplainInput {
	verdict: TriageVerdict;
	localization: Localization;
}

export interface ProposeInput {
	localization: Localization;
	explanation: Explanation;
	repo: { owner: string; repo: string; base: string } | null;
}

export interface Investigation {
	cause: CauseKind;
	culpritPaths: string[];
	rationale: string;
	keyEvidence: string[];
	dequelRev: string;
	dequelStale: boolean;
}

export interface InvestigateInput {
	run: DiagRun;
	deployment: DeploymentFacts;
	logText: string;
	verdict: TriageVerdict;
	onProgress: (line: string) => void;
}

export type InvestigateFn = (input: InvestigateInput) => Promise<Investigation>;

export interface FixdiagPrograms {
	triageLogs(input: TriageInput): Promise<TriageVerdict>;
	explainFix(input: ExplainInput): Promise<Explanation>;
	draftProposal(input: ProposeInput): Promise<Proposal>;
}
