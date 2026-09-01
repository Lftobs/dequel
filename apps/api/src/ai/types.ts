export type AiProvider = "openai" | "gemini" | "grok" | "claude";

export interface AiFixSuggestion {
  title: string;
  description: string;
  actionType?: "command" | "code" | "config" | "env";
  snippet?: string;
}

export interface AiDiagnosisResult {
  provider: AiProvider;
  model: string;
  summary: string;
  rootCause: string;
  explanation: string;
  suggestedFixes: AiFixSuggestion[];
  rawResponse?: string;
}

export interface AiDiagnoseOptions {
  deploymentId: string;
  provider?: AiProvider;
  model?: string;
  apiKey?: string;
  customPrompt?: string;
}

export interface AiProviderConfig {
  apiKey: string;
  model: string;
}

export interface ProviderCallParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}
