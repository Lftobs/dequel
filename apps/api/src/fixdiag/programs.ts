import { ax } from "@ax-llm/ax";
import { asCause, asConfidence, asString, asStringArray, type DiagLlm } from "./llm";
import type {
	DequelReport,
	ExplainInput,
	Explanation,
	FixdiagPrograms,
	Localization,
	Proposal,
	ProposeInput,
	TriageInput,
	TriageVerdict,
	UserFix,
} from "./types";

const nonEmpty = (value: string, label: string): string =>
	value.trim() ? value : `(${label} unavailable — evidence partial or empty)`;

const clip = (value: string, max = 12_000): string =>
	value.length > max ? `${value.slice(0, max)}\n…[truncated ${value.length - max} chars]` : value;

const ERROR_HINT =
	/error|fail|exception|denied|refused|timeout|timed out|not found|missing|unable|cannot|invalid|misbehaving|unrecognized/i;

export const heuristicSignalLines = (logText: string, max = 5): string[] => {
	const lines = logText
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const hits = lines.filter((line) => ERROR_HINT.test(line));
	return (hits.length > 0 ? hits : lines).slice(-max);
};

const PROGRAM_TIMEOUT_MS = 90_000;

export const createPrograms = (llm: DiagLlm): FixdiagPrograms => {
	const opts = { timeout: PROGRAM_TIMEOUT_MS, maxRetries: 1 } as const;

	const triage = ax(
		'failureReason:string, logText:string -> failingStage:string, signalLines:string[], confidence:class "low,medium,high"',
		{
			description:
				'You triage a failed Dequel deployment. Identify which build stage failed and quote the 1-5 most telling log lines. Reply with one line per field and no bullet dashes, for example:\nFailing Stage: Docker Build\nSignal Lines: ["[build] ERROR: ..."]\nConfidence: high',
		},
	);

	const explain = ax("verdict:string, localization:string -> summary:string, fixSteps:string[], patchHint:string", {
		description:
			"You explain a diagnosed build failure to the developer who owns the deployment. summary is 2-4 sentences. fixSteps are concrete actions. patchHint is a unified diff when the fix is a small code change, else the exact text (no diff). Reply with one line per field and no bullet dashes.",
	});

	const proposeUserFix = ax(
		'localization:string, explanation:string, repo:string -> cause:class "user-source,unknown", title:string, body:string, suggestedDiff:string',
		{
			description:
				"You draft a pull request fixing a diagnosed failure in the user's own source. Always fill title, body, and suggestedDiff; write the exact text (no diff) for suggestedDiff when no code change applies. Answer unknown for cause when the evidence does not support a user-source fix. Reply with one line per field and no bullet dashes.",
		},
	);

	const proposeDequelReport = ax(
		'localization:string, explanation:string, repo:string -> cause:class "dequel-source,unknown", problem:string, fixCause:string, proposedFix:string',
		{
			description:
				"You write a bug report for the Dequel platform team about a failure in Dequel's own tooling. Always fill problem, fixCause, and proposedFix with concrete content. Answer unknown for cause when the evidence does not support a Dequel-source report. Reply with one line per field and no bullet dashes.",
		},
	);

	return {
		triageLogs: async (input: TriageInput): Promise<TriageVerdict> => {
			const failureReason = nonEmpty(input.failureReason ?? "", "failure reason");
			const logText = clip(nonEmpty(input.logText, "build logs"));
			try {
				const out = await triage.forward(llm, { failureReason, logText }, opts);
				return {
					failingStage: asString(out.failingStage, "unknown"),
					signalLines: asStringArray(out.signalLines, 8),
					confidence: asConfidence(out.confidence),
				};
			} catch {
				return { failingStage: "unknown", signalLines: heuristicSignalLines(logText), confidence: "low" };
			}
		},

		explainFix: async (input: ExplainInput): Promise<Explanation> => {
			const verdict = JSON.stringify(input.verdict);
			const localization = JSON.stringify(input.localization);
			try {
				const out = await explain.forward(llm, { verdict, localization }, opts);
				const patchHint = asString(out.patchHint);
				return {
					summary: asString(out.summary),
					fixSteps: asStringArray(out.fixSteps, 12),
					patchHint: patchHint.trim() ? patchHint : null,
				};
			} catch {
				return {
					summary: asString((input.localization as Localization).rationale, "Explanation unavailable."),
					fixSteps: [],
					patchHint: null,
				};
			}
		},

		draftProposal: async (input: ProposeInput): Promise<Proposal> => {
			const base = {
				localization: JSON.stringify(input.localization),
				explanation: JSON.stringify(input.explanation),
				repo: JSON.stringify(input.repo),
			};
			if (input.localization.cause === "user-source") {
				try {
					const out = await proposeUserFix.forward(llm, base, opts);
					const userFix: UserFix = {
						title: asString(out.title, "Fix build failure"),
						body: asString(out.body),
						suggestedDiff: asString(out.suggestedDiff).trim() || null,
					};
					return { cause: asCause(out.cause) === "unknown" ? "unknown" : "user-source", userFix };
				} catch {
					return {
						cause: "user-source",
						userFix: { title: "Fix build failure", body: input.localization.rationale, suggestedDiff: null },
					};
				}
			}
			if (input.localization.cause === "dequel-source") {
				try {
					const out = await proposeDequelReport.forward(llm, base, opts);
					const dequelReport: DequelReport = {
						problem: asString(out.problem),
						cause: asString(out.fixCause),
						proposedFix: asString(out.proposedFix),
					};
					return { cause: asCause(out.cause) === "unknown" ? "unknown" : "dequel-source", dequelReport };
				} catch {
					return {
						cause: "dequel-source",
						dequelReport: { problem: input.localization.rationale, cause: "", proposedFix: "" },
					};
				}
			}
			return { cause: "unknown" };
		},
	};
};
