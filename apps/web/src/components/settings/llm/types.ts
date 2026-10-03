export interface ProviderMeta {
	id: string;
	label: string;
	desc: string;
	keyPlaceholder: string;
	docsUrl?: string;
	defaultBaseUrl?: string;
}

export const PROVIDERS: ProviderMeta[] = [
	{
		id: "openai",
		label: "OpenAI",
		desc: "GPT-4o, o1, o3-mini & reasoning models",
		keyPlaceholder: "sk-proj-...",
		docsUrl: "https://platform.openai.com/api-keys",
	},
	{
		id: "anthropic",
		label: "Anthropic",
		desc: "Claude 3.5 Sonnet, Claude 3 Opus & Haiku",
		keyPlaceholder: "sk-ant-api03-...",
		docsUrl: "https://console.anthropic.com/settings/keys",
	},
	{
		id: "gemini",
		label: "Google Gemini",
		desc: "Gemini 2.5 Flash, 2.5 Pro & 1.5 Pro",
		keyPlaceholder: "AIzaSy...",
		docsUrl: "https://aistudio.google.com/app/apikey",
	},
	{
		id: "groq",
		label: "Groq",
		desc: "Ultra-fast Llama 3.3 70B & open models",
		keyPlaceholder: "gsk_...",
		docsUrl: "https://console.groq.com/keys",
	},
	{
		id: "ollama",
		label: "Ollama (Self-Hosted)",
		desc: "Run local open-weight models via Docker / HTTP",
		keyPlaceholder: "(optional for local Ollama)",
		defaultBaseUrl: "http://host.docker.internal:11435/v1",
	},
	{
		id: "custom",
		label: "Custom (OpenAI-Compatible)",
		desc: "vLLM, LocalAI, OpenRouter, Together, etc.",
		keyPlaceholder: "sk-...",
		defaultBaseUrl: "https://api.your-endpoint.com/v1",
	},
];
