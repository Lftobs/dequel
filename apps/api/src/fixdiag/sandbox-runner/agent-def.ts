import { ax } from "@ax-llm/ax";
import { buildFileTools, buildFixTools } from "./tools";

export interface InvestigatorContext {
	progressPath: string;
	projectRoot: string | null;
	dequelRef: string;
}

const INVESTIGATOR_MAX_STEPS = 20;
const FIXER_MAX_STEPS = 10;

export const createInvestigator = (ctx: InvestigatorContext, withTools = true) => {
	const functions = withTools
		? buildFileTools({ dequel: "/srv/dequel-src", project: ctx.projectRoot }, ctx.progressPath)
		: [];
	return ax(
		'failureReason:string, logText:string, taskBrief:string -> cause:class "user-source,dequel-source,unknown", culpritPaths:string[], rationale:string, keyEvidence:string[]',
		{
			functions,
			maxSteps: INVESTIGATOR_MAX_STEPS,
			description: withTools
				? "Investigate a failed Dequel deployment using the provided read-only file tools. Scope dequel is Dequel's own platform source; scope project is the deployed project's source and may be absent. Decide first whether the cause is in the user's source or Dequel's source, then gather evidence with a few targeted calls. Failures in Dequel's build environment itself (BuildKit, Docker daemon/network/DNS, railpack image pulls) are dequel-source even when no Dequel code file references the failing artifact; reserve unknown for cases where neither side is implicated. Be economical: prefer searchText over broad lists, read only the files that matter, never re-read a file, never repeat a search that returned 0 hits, and after at most 8 tool calls stop calling tools and write your final answer from what you have. You cannot write files, run commands, or reach the network. Prefer unknown over guessing."
				: "Write your final investigation answer NOW from the conversation so far. Tool use is disabled: do not emit any tool calls, answer directly with cause, culpritPaths, rationale, and keyEvidence. Prefer unknown over guessing.",
		},
	);
};

export const createFixer = (ctx: InvestigatorContext, withTools = true) => {
	const functions = withTools
		? buildFixTools({ dequel: "/srv/dequel-src", project: ctx.projectRoot }, ctx.progressPath)
		: [];
	return ax("fixBrief:string -> summary:string, changedFiles:string[]", {
		functions,
		maxSteps: FIXER_MAX_STEPS,
		description: withTools
			? "Fix a diagnosed build failure in the project source. You have read tools over the dequel scope (reference only, never modify) and read plus edit tools over the project scope. Make the smallest change that fixes the diagnosed failure: prefer editFile with exact matches, create files only when necessary, never touch lockfiles, vendored code, or anything outside the project scope. End by summarizing the change and listing every file you modified."
			: "Write your final fix summary NOW from the conversation so far. Tool use is disabled: do not emit any tool calls, answer directly with summary and changedFiles.",
	});
};
