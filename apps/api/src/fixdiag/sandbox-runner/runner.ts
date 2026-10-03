import { appendFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { asCause, asString, asStringArray, buildLlm } from "../llm";
import { describeError, forwardWithFallback } from "./forward";
import type { LlmProvider } from "../types";
import { createFixer, createInvestigator } from "./agent-def";

interface BaseInput {
	mode: "investigate" | "fix";
	provider: LlmProvider;
	model: string;
	apiKey: string;
	baseUrl: string | null;
	hasProjectSource: boolean;
	dequelRev: string;
	dequelStale: boolean;
	deadlineMs?: number;
}

interface InvestigateInput extends BaseInput {
	mode: "investigate";
	failureReason: string;
	logText: string;
	taskBrief: string;
}

interface FixInput extends BaseInput {
	mode: "fix";
	fixBrief: string;
}

type RunnerInput = InvestigateInput | FixInput;

const MAX_LOG_CHARS = 3_000;
const FORWARD_OPTS = { timeout: 120_000, maxRetries: 1 } as const;

const clipTail = (value: string, max: number): string =>
	value.length > max ? `…[last ${max} of ${value.length} chars]\n${value.slice(-max)}` : value;

const main = async (): Promise<void> => {
	const [inputPath] = Bun.argv.slice(2);
	if (!inputPath) {
		console.error("usage: runner.js <input.json>");
		process.exit(2);
	}
	const dir = dirname(inputPath);
	const progressPath = join(dir, "progress.jsonl");
	const raw = JSON.parse(await readFile(inputPath, "utf8")) as RunnerInput;
	const deadline = setTimeout(
		() => {
			console.error("agent deadline exceeded");
			process.exit(2);
		},
		raw.deadlineMs ?? 9 * 60_000,
	);
	try {
		const llm = buildLlm(raw.provider, raw.apiKey, raw.baseUrl ?? null, raw.model);
		const ctx = {
			progressPath,
			projectRoot: raw.hasProjectSource ? "/srv/project-src" : null,
			dequelRef: raw.dequelRev,
		};
		if (raw.mode === "fix") {
			await appendFile(progressPath, "fix started\n").catch(() => {});
			const out = await forwardWithFallback(
				createFixer(ctx),
				createFixer(ctx, false),
				llm,
				{ fixBrief: raw.fixBrief },
				progressPath,
			);
			await writeFile(
				join(dir, "report.json"),
				JSON.stringify({
					summary: asString(out.summary),
					changedFiles: asStringArray(out.changedFiles, 32),
				}),
			);
			await appendFile(progressPath, "fix complete\n").catch(() => {});
			return;
		}
		await appendFile(progressPath, "investigation started\n").catch(() => {});
		const out = await forwardWithFallback(
			createInvestigator(ctx),
			createInvestigator(ctx, false),
			llm,
			{
				failureReason: clipTail(raw.failureReason, 2_000),
				logText: clipTail(raw.logText, MAX_LOG_CHARS),
				taskBrief: raw.taskBrief,
			},
			progressPath,
		);
		await writeFile(
			join(dir, "report.json"),
			JSON.stringify({
				cause: asCause(out.cause),
				culpritPaths: asStringArray(out.culpritPaths, 8),
				rationale: asString(out.rationale),
				keyEvidence: asStringArray(out.keyEvidence, 8),
				dequelRev: raw.dequelRev,
				dequelStale: raw.dequelStale,
			}),
		);
		await appendFile(progressPath, "investigation complete\n").catch(() => {});
	} finally {
		clearTimeout(deadline);
	}
};

await main().catch((err) => {
	console.error(describeError(err));
	process.exit(1);
});
