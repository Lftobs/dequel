import type { ProviderCallParams } from "../types";

export async function callGemini(params: ProviderCallParams): Promise<string> {
  const model = params.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

  const body = {
    system_instruction: {
      parts: [{ text: params.systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: params.userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMsg = `Gemini API error (${res.status})`;
    try {
      const errObj = JSON.parse(errorText);
      if (errObj.error?.message) errorMsg = `Gemini: ${errObj.error.message}`;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = (await res.json()) as any;
  const candidate = data.candidates?.[0];
  const part = candidate?.content?.parts?.[0];
  const content = part?.text;

  if (!content) {
    throw new Error("Gemini returned an empty response");
  }

  return content;
}
