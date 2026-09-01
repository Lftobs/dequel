import type { AiProvider } from "./types";
import { resolveProviderConfig } from "./diagnose";
import { callOpenAi } from "./providers/openai";
import { callGemini } from "./providers/gemini";
import { callGrok } from "./providers/grok";
import { callClaude } from "./providers/claude";

export async function testAiConnection(
  providerReq: AiProvider,
  apiKeyReq?: string,
  modelReq?: string,
): Promise<{ ok: boolean; message: string; provider: AiProvider; model: string }> {
  const { provider, model, apiKey } = await resolveProviderConfig(
    providerReq,
    modelReq,
    apiKeyReq,
  );

  const systemPrompt = "You are a test ping responder. Respond with the single word: OK.";
  const userPrompt = "Ping test";

  try {
    let output = "";
    if (provider === "openai") {
      output = await callOpenAi({ apiKey, model, systemPrompt, userPrompt });
    } else if (provider === "gemini") {
      output = await callGemini({ apiKey, model, systemPrompt, userPrompt });
    } else if (provider === "grok") {
      output = await callGrok({ apiKey, model, systemPrompt, userPrompt });
    } else if (provider === "claude") {
      output = await callClaude({ apiKey, model, systemPrompt, userPrompt });
    }

    return {
      ok: true,
      message: `Successfully connected to ${provider} (${model})`,
      provider,
      model,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || `Failed to connect to ${provider}`,
      provider,
      model,
    };
  }
}
