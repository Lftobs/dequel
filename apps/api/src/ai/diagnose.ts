import type { AiDiagnoseOptions, AiDiagnosisResult, AiProvider } from "./types";
import { getAiSettings, saveAiDiagnosis } from "../db/repo/ai-settings";
import { getDeploymentById, getLogs } from "../db/repo/deployments";
import { getProjectById } from "../db/repo/projects";
import { SYSTEM_PROMPT, extractBuildErrorContext } from "./prompt";
import { callOpenAi } from "./providers/openai";
import { callGemini } from "./providers/gemini";
import { callGrok } from "./providers/grok";
import { callClaude } from "./providers/claude";

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  grok: "grok-2-latest",
  claude: "claude-3-5-sonnet-20241022",
};

export async function resolveProviderConfig(
  providerReq?: AiProvider,
  modelReq?: string,
  apiKeyReq?: string,
): Promise<{ provider: AiProvider; model: string; apiKey: string }> {
  const settings = await getAiSettings();
  const provider: AiProvider = providerReq || settings.defaultProvider || "openai";

  let apiKey = apiKeyReq;
  let defaultModel = DEFAULT_MODELS[provider];

  if (provider === "openai") {
    apiKey = apiKey || settings.openaiApiKey || process.env.OPENAI_API_KEY;
    defaultModel = settings.openaiModel || DEFAULT_MODELS.openai;
  } else if (provider === "gemini") {
    apiKey = apiKey || settings.geminiApiKey || process.env.GEMINI_API_KEY;
    defaultModel = settings.geminiModel || DEFAULT_MODELS.gemini;
  } else if (provider === "grok") {
    apiKey = apiKey || settings.grokApiKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    defaultModel = settings.grokModel || DEFAULT_MODELS.grok;
  } else if (provider === "claude") {
    apiKey = apiKey || settings.claudeApiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    defaultModel = settings.claudeModel || DEFAULT_MODELS.claude;
  }

  if (!apiKey) {
    throw new Error(`API key not configured for AI provider '${provider}'. Please configure it in Settings or provide an API key.`);
  }

  const model = modelReq || defaultModel;
  return { provider, model, apiKey };
}

function parseAiResponse(raw: string, provider: AiProvider, model: string): AiDiagnosisResult {
  let cleaned = raw.trim();
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    const summary = String(parsed.summary || "Build/deployment failed");
    const rootCause = String(parsed.rootCause || parsed.root_cause || "Error occurred during execution");
    const explanation = String(parsed.explanation || "See logs for details");
    const rawFixes = Array.isArray(parsed.suggestedFixes || parsed.suggested_fixes) ? (parsed.suggestedFixes || parsed.suggested_fixes) : [];

    const suggestedFixes = rawFixes.map((f: any) => ({
      title: String(f.title || "Fix instruction"),
      description: String(f.description || ""),
      actionType: (f.actionType || f.action_type || "code") as any,
      snippet: f.snippet ? String(f.snippet) : undefined,
    }));

    return {
      provider,
      model,
      summary,
      rootCause,
      explanation,
      suggestedFixes,
      rawResponse: raw,
    };
  } catch {
    return {
      provider,
      model,
      summary: "Build failure analyzed",
      rootCause: "Review the raw AI diagnosis below for details",
      explanation: raw,
      suggestedFixes: [],
      rawResponse: raw,
    };
  }
}

export async function diagnoseDeploymentFailure(options: AiDiagnoseOptions): Promise<AiDiagnosisResult> {
  const deployment = await getDeploymentById(options.deploymentId);
  if (!deployment) {
    throw new Error(`Deployment ${options.deploymentId} not found`);
  }

  const project = deployment.projectId ? await getProjectById(deployment.projectId) : null;
  const rawLogs = await getLogs(options.deploymentId);

  const errorContext = extractBuildErrorContext({
    deploymentId: deployment.id,
    projectName: project?.name,
    projectType: project?.projectType,
    buildType: project?.buildType,
    sourceType: deployment.sourceType,
    branch: deployment.branch,
    failureReason: deployment.failureReason,
    logs: rawLogs,
  });

  const userPrompt = [
    options.customPrompt ? `User Question / Instructions: ${options.customPrompt}\n` : "",
    "Please analyze the following deployment build failure and provide a structured diagnosis:",
    errorContext,
  ].filter(Boolean).join("\n");

  const { provider, model, apiKey } = await resolveProviderConfig(
    options.provider,
    options.model,
    options.apiKey,
  );

  let rawOutput = "";
  if (provider === "openai") {
    rawOutput = await callOpenAi({ apiKey, model, systemPrompt: SYSTEM_PROMPT, userPrompt });
  } else if (provider === "gemini") {
    rawOutput = await callGemini({ apiKey, model, systemPrompt: SYSTEM_PROMPT, userPrompt });
  } else if (provider === "grok") {
    rawOutput = await callGrok({ apiKey, model, systemPrompt: SYSTEM_PROMPT, userPrompt });
  } else if (provider === "claude") {
    rawOutput = await callClaude({ apiKey, model, systemPrompt: SYSTEM_PROMPT, userPrompt });
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const diagnosis = parseAiResponse(rawOutput, provider, model);

  await saveAiDiagnosis({
    deploymentId: deployment.id,
    provider: diagnosis.provider,
    model: diagnosis.model,
    summary: diagnosis.summary,
    rootCause: diagnosis.rootCause,
    explanation: diagnosis.explanation,
    suggestedFixes: diagnosis.suggestedFixes,
    rawResponse: rawOutput,
  }).catch((err) => {
    console.error("[AI Diagnose] Failed to save diagnosis record:", err);
  });

  return diagnosis;
}
