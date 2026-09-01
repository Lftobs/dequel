import type { ProviderCallParams } from "../types";

export async function callClaude(params: ProviderCallParams): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";
  const body = {
    model: params.model || "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    system: params.systemPrompt,
    messages: [
      { role: "user", content: params.userPrompt },
    ],
    temperature: 0.2,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMsg = `Claude API error (${res.status})`;
    try {
      const errObj = JSON.parse(errorText);
      if (errObj.error?.message) errorMsg = `Claude: ${errObj.error.message}`;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = (await res.json()) as any;
  const content = data.content?.[0]?.text;
  if (!content) {
    throw new Error("Claude returned an empty response");
  }

  return content;
}
