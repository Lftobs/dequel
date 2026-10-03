import { appendFile } from "node:fs/promises";
import { AxMemory } from "@ax-llm/ax";

export const FORWARD_OPTS = { timeout: 120_000, maxRetries: 1 } as const;

export type Forwardable = {
	forward: (
		llm: unknown,
		values: Record<string, unknown>,
		opts?: Record<string, unknown>,
	) => Promise<Record<string, unknown>>;
};

export const chainText = (err: unknown): string => {
	const parts: string[] = [];
	const seen = new Set<unknown>();
	const visit = (cur: unknown): void => {
		if (!cur || seen.has(cur)) return;
		seen.add(cur);
		if (typeof cur === "string") {
			if (cur.trim()) parts.push(cur.trim());
			return;
		}
		if (typeof cur !== "object") return;
		const e = cur as { message?: unknown; responseBody?: unknown; cause?: unknown; errors?: unknown };
		if (typeof e.message === "string" && e.message.trim()) parts.push(e.message.trim());
		if (e.responseBody != null) {
			const text = typeof e.responseBody === "string" ? e.responseBody : JSON.stringify(e.responseBody);
			if (text && text.trim() && text.trim() !== "{}") parts.push(text.trim());
		}
		if (Array.isArray(e.errors)) for (const sub of e.errors) visit(sub);
		visit(e.cause);
	};
	visit(err);
	return parts.join(" | ").slice(0, 960);
};

export const describeError = (err: unknown): string => {
	let message = "";
	let body = "";
	const seen = new Set<unknown>();
	let cur: unknown = err;
	while (cur && typeof cur === "object" && !seen.has(cur)) {
		seen.add(cur);
		const e = cur as { message?: unknown; responseBody?: unknown; cause?: unknown };
		if (!message && typeof e.message === "string" && e.message.trim()) message = e.message.trim();
		if (!body && e.responseBody != null) {
			const text = typeof e.responseBody === "string" ? e.responseBody : JSON.stringify(e.responseBody);
			if (text && text.trim() && text.trim() !== "{}") body = text.trim();
		}
		cur = e.cause;
	}
	if (body && !message.includes(body)) return `${body} | ${message}`.slice(0, 480);
	return (message || String(err)).slice(0, 480);
};

export const forwardWithFallback = async (
	prog: Forwardable,
	answerOnlyProg: Forwardable,
	llm: unknown,
	values: Record<string, unknown>,
	progressPath: string,
): Promise<Record<string, unknown>> => {
	const mem = new AxMemory();
	try {
		return await prog.forward(llm, values, { ...FORWARD_OPTS, mem });
	} catch (err) {
		if (!/max steps/i.test(chainText(err))) throw err;
		await appendFile(progressPath, "step budget exhausted; writing final answer without further tool calls\n").catch(
			() => {},
		);
		return await answerOnlyProg.forward(llm, values, { ...FORWARD_OPTS, mem, functionCall: "none", maxSteps: 6 });
	}
};
