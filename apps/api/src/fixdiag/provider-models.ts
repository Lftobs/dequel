export interface FetchModelsOptions {
	provider: string;
	apiKey?: string;
	baseUrl?: string | null;
	timeoutMs?: number;
}

export const DEFAULT_PROVIDER_MODELS: Record<string, string[]> = {
	openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini", "gpt-4-turbo"],
	anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
	gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash"],
	groq: [
		"llama-3.3-70b-versatile",
		"llama-3.1-8b-instant",
		"meta-llama/llama-4-maverick-17b-128e-instruct",
		"moonshotai/kimi-k2-instruct",
		"openai/gpt-oss-120b",
	],
	ollama: ["llama3:latest", "qwen2.5-coder:latest", "mistral:latest", "deepseek-r1:latest"],
	custom: [],
};

const EXCLUDED_OPENAI_PATTERNS =
	/embedding|whisper|tts|dall-e|moderation|babbage|davinci|realtime|transcription|audio|canary|search/i;

const fetchOpenAiModels = async (apiKey: string, baseUrl?: string | null, timeoutMs = 8000): Promise<string[]> => {
	const root = baseUrl ? baseUrl.replace(/\/+$/, "") : "https://api.openai.com/v1";
	const url = root.endsWith("/models") ? root : `${root}/models`;
	const res = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!res.ok) {
		throw new Error(`OpenAI models request failed: ${res.status} ${res.statusText}`);
	}
	const body = (await res.json()) as { data?: Array<{ id: string }> };
	const rawList = Array.isArray(body?.data) ? body.data : [];
	const filtered = rawList
		.map((m) => m.id)
		.filter((id): id is string => typeof id === "string" && !EXCLUDED_OPENAI_PATTERNS.test(id));

	filtered.sort((a, b) => {
		const aRank = a.includes("gpt-4o") || a.startsWith("o1") || a.startsWith("o3") ? 0 : 1;
		const bRank = b.includes("gpt-4o") || b.startsWith("o1") || b.startsWith("o3") ? 0 : 1;
		if (aRank !== bRank) return aRank - bRank;
		return a.localeCompare(b);
	});
	return filtered;
};

const fetchAnthropicModels = async (apiKey: string, timeoutMs = 8000): Promise<string[]> => {
	const res = await fetch("https://api.anthropic.com/v1/models", {
		method: "GET",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"Content-Type": "application/json",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!res.ok) {
		throw new Error(`Anthropic models request failed: ${res.status} ${res.statusText}`);
	}
	const body = (await res.json()) as { data?: Array<{ id: string }> };
	const rawList = Array.isArray(body?.data) ? body.data : [];
	const filtered = rawList.map((m) => m.id).filter((id): id is string => typeof id === "string");

	filtered.sort((a, b) => {
		const aRank = a.includes("sonnet") ? 0 : a.includes("opus") ? 1 : a.includes("haiku") ? 2 : 3;
		const bRank = b.includes("sonnet") ? 0 : b.includes("opus") ? 1 : b.includes("haiku") ? 2 : 3;
		if (aRank !== bRank) return aRank - bRank;
		return b.localeCompare(a);
	});
	return filtered;
};

const fetchGeminiModels = async (apiKey: string, timeoutMs = 8000): Promise<string[]> => {
	const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
	const res = await fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!res.ok) {
		throw new Error(`Gemini models request failed: ${res.status} ${res.statusText}`);
	}
	const body = (await res.json()) as {
		models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
	};
	const rawList = Array.isArray(body?.models) ? body.models : [];
	const filtered = rawList
		.filter((m) => {
			const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
			return methods.includes("generateContent");
		})
		.map((m) => (typeof m.name === "string" ? m.name.replace(/^models\//, "") : ""))
		.filter((id): id is string => !!id && !/embedding|aqa|bison|gecko/i.test(id));

	filtered.sort((a, b) => {
		const aRank = a.includes("flash") ? 0 : a.includes("pro") ? 1 : 2;
		const bRank = b.includes("flash") ? 0 : b.includes("pro") ? 1 : 2;
		if (aRank !== bRank) return aRank - bRank;
		return a.localeCompare(b);
	});
	return filtered;
};

const fetchGroqModels = async (apiKey: string, baseUrl?: string | null, timeoutMs = 8000): Promise<string[]> => {
	const root = baseUrl ? baseUrl.replace(/\/+$/, "") : "https://api.groq.com/openai/v1";
	const url = root.endsWith("/models") ? root : `${root}/models`;
	const res = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!res.ok) {
		throw new Error(`Groq models request failed: ${res.status} ${res.statusText}`);
	}
	const body = (await res.json()) as { data?: Array<{ id: string; active?: boolean }> };
	const rawList = Array.isArray(body?.data) ? body.data : [];
	const filtered = rawList
		.filter((m) => m.active !== false)
		.map((m) => m.id)
		.filter((id): id is string => typeof id === "string" && !/whisper|tts/i.test(id));

	filtered.sort((a, b) => a.localeCompare(b));
	return filtered;
};

const fetchOllamaModels = async (baseUrl?: string | null, timeoutMs = 8000): Promise<string[]> => {
	const raw = baseUrl || "http://host.docker.internal:11435";
	const root = raw.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
	let models: string[] = [];

	try {
		const res = await fetch(`${root}/api/tags`, {
			method: "GET",
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (res.ok) {
			const body = (await res.json()) as { models?: Array<{ name: string }> };
			if (Array.isArray(body?.models)) {
				models = body.models.map((m) => m.name).filter((n): n is string => typeof n === "string");
			}
		}
	} catch {}

	if (models.length === 0) {
		try {
			const res = await fetch(`${root}/v1/models`, {
				method: "GET",
				signal: AbortSignal.timeout(timeoutMs),
			});
			if (res.ok) {
				const body = (await res.json()) as { data?: Array<{ id: string }> };
				if (Array.isArray(body?.data)) {
					models = body.data.map((m) => m.id).filter((n): n is string => typeof n === "string");
				}
			}
		} catch {}
	}

	return models;
};

const fetchCustomModels = async (apiKey?: string, baseUrl?: string | null, timeoutMs = 8000): Promise<string[]> => {
	if (!baseUrl) return [];
	const cleanBase = baseUrl.replace(/\/+$/, "");
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

	const endpoints = cleanBase.endsWith("/models")
		? [cleanBase]
		: cleanBase.endsWith("/v1")
			? [`${cleanBase}/models`]
			: [`${cleanBase}/models`, `${cleanBase}/v1/models`];

	for (const endpoint of endpoints) {
		try {
			const res = await fetch(endpoint, {
				method: "GET",
				headers,
				signal: AbortSignal.timeout(timeoutMs),
			});
			if (res.ok) {
				const body = (await res.json()) as any;
				const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
				const extracted = list
					.map((m: any) => (typeof m === "string" ? m : m?.id || m?.name))
					.filter((id: unknown): id is string => typeof id === "string");
				if (extracted.length > 0) return extracted;
			}
		} catch {}
	}
	return [];
};

export const fetchProviderModels = async (options: FetchModelsOptions): Promise<string[]> => {
	const { provider, apiKey = "", baseUrl, timeoutMs = 8000 } = options;
	try {
		let models: string[] = [];
		switch (provider) {
			case "openai":
				if (apiKey) models = await fetchOpenAiModels(apiKey, baseUrl, timeoutMs);
				break;
			case "anthropic":
				if (apiKey) models = await fetchAnthropicModels(apiKey, timeoutMs);
				break;
			case "gemini":
				if (apiKey) models = await fetchGeminiModels(apiKey, timeoutMs);
				break;
			case "groq":
				if (apiKey) models = await fetchGroqModels(apiKey, baseUrl, timeoutMs);
				break;
			case "ollama":
				models = await fetchOllamaModels(baseUrl, timeoutMs);
				break;
			case "custom":
				models = await fetchCustomModels(apiKey, baseUrl, timeoutMs);
				break;
		}

		if (models.length > 0) {
			return Array.from(new Set(models));
		}
	} catch {}

	return DEFAULT_PROVIDER_MODELS[provider] ?? [];
};
