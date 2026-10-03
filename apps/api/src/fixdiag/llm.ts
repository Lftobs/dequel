import { ai } from "@ax-llm/ax";
import type { CauseKind, LlmProvider, TriageConfidence } from "./types";

export const buildLlm = (provider: LlmProvider, apiKey: string, baseUrl: string | null, model: string) => {
	switch (provider) {
		case "openai":
			return ai({ name: "openai", apiKey, config: { model } });
		case "anthropic":
			return ai({ name: "anthropic", apiKey, config: { model } });
		case "gemini":
			return ai({ name: "google-gemini", apiKey, config: { model } });
		case "groq":
			return ai({ name: "groq", apiKey, config: { model } });
		case "ollama":
			return ai({
				name: "openai",
				apiKey: apiKey || "ollama",
				apiURL: baseUrl ?? "http://host.docker.internal:11435/v1",
				config: { model, maxTokens: 8192 },
			});
		case "custom":
			return ai({ name: "openai", apiKey, apiURL: baseUrl ?? undefined, config: { model } });
	}
};

export type DiagLlm = ReturnType<typeof buildLlm>;

export const asString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

export const asStringArray = (value: unknown, max = 32): string[] =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, max) : [];

export const asConfidence = (value: unknown): TriageConfidence =>
	value === "low" || value === "medium" || value === "high" ? value : "low";

export const asCause = (value: unknown): CauseKind =>
	value === "user-source" || value === "dequel-source" || value === "unknown" ? value : "unknown";
