import type { ProviderCallParams } from "../types";

export async function callGrok(params: ProviderCallParams): Promise<string> {
  const url = "https://api.x.ai/v1/chat/completions";
  const body = {
    model: params.model || "grok-2-latest",
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
    temperature: 0.2,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMsg = `Grok API error (${res.status})`;
    try {
      const errObj = JSON.parse(errorText);
      if (errObj.error?.message) errorMsg = `Grok: ${errObj.error.message}`;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Grok returned an empty response");
  }

  return content;
}
