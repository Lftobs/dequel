import type { ProviderCallParams } from "../types";

export async function callOpenAi(params: ProviderCallParams): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: params.model || "gpt-4o-mini",
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
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
    let errorMsg = `OpenAI API error (${res.status})`;
    try {
      const errObj = JSON.parse(errorText);
      if (errObj.error?.message) errorMsg = `OpenAI: ${errObj.error.message}`;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return content;
}
