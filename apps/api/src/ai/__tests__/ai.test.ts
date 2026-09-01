import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { extractBuildErrorContext, SYSTEM_PROMPT } from "../prompt";
import { resolveProviderConfig, diagnoseDeploymentFailure } from "../diagnose";
import { testAiConnection } from "../test-connection";
import { callOpenAi } from "../providers/openai";
import { callGemini } from "../providers/gemini";
import { callGrok } from "../providers/grok";
import { callClaude } from "../providers/claude";

describe("AI Build Failure Analysis", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("extractBuildErrorContext", () => {
    it("extracts context and strips ANSI escape sequences", () => {
      const result = extractBuildErrorContext({
        deploymentId: "dep-1",
        projectName: "my-web-app",
        projectType: "web",
        buildType: "railpack",
        sourceType: "git",
        branch: "main",
        failureReason: "Build exited with code 1",
        logs: [
          { sequence: 1, stage: "build", message: "\u001b[32m[info]\u001b[0m Installing dependencies..." },
          { sequence: 2, stage: "build", message: "\u001b[31mError: Cannot find module 'pg'\u001b[0m" },
          { sequence: 3, stage: "build", message: "Command failed: bun build" },
        ],
      });

      expect(result).toContain("Project: my-web-app");
      expect(result).toContain("Build Strategy: railpack");
      expect(result).toContain("Source: git (branch: main)");
      expect(result).toContain("Failure Reason: Build exited with code 1");
      expect(result).toContain("Error: Cannot find module 'pg'");
      expect(result).not.toContain("\u001b[31m");
    });
  });

  describe("resolveProviderConfig", () => {
    it("throws when no API key is provided or configured", async () => {
      await expect(resolveProviderConfig("openai", undefined, undefined)).rejects.toThrow(
        "API key not configured for AI provider 'openai'",
      );
    });

    it("accepts explicit API key and custom model", async () => {
      const config = await resolveProviderConfig("openai", "gpt-4o", "sk-test-123");
      expect(config.provider).toBe("openai");
      expect(config.model).toBe("gpt-4o");
      expect(config.apiKey).toBe("sk-test-123");
    });

    it("uses default model when model is omitted", async () => {
      const config = await resolveProviderConfig("gemini", undefined, "gemini-key-123");
      expect(config.provider).toBe("gemini");
      expect(config.model).toBe("gemini-2.0-flash");
      expect(config.apiKey).toBe("gemini-key-123");
    });
  });

  describe("Provider HTTP Clients", () => {
    it("calls OpenAI chat completions correctly", async () => {
      globalThis.fetch = mock(async (url: any, opts: any) => {
        expect(url.toString()).toBe("https://api.openai.com/v1/chat/completions");
        const body = JSON.parse(opts.body);
        expect(body.model).toBe("gpt-4o-mini");
        expect(body.response_format).toEqual({ type: "json_object" });
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ summary: "Missing pg module" }) } }],
        }), { status: 200 });
      });

      const response = await callOpenAi({
        apiKey: "test-openai-key",
        model: "gpt-4o-mini",
        systemPrompt: "sys",
        userPrompt: "user",
      });

      expect(response).toContain("Missing pg module");
    });

    it("calls Gemini generateContent correctly", async () => {
      globalThis.fetch = mock(async (url: any, opts: any) => {
        expect(url.toString()).toContain("generativelanguage.googleapis.com");
        expect(url.toString()).toContain("key=test-gemini-key");
        const body = JSON.parse(opts.body);
        expect(body.generationConfig.responseMimeType).toBe("application/json");
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: "Missing pg in Gemini" }) }] } }],
        }), { status: 200 });
      });

      const response = await callGemini({
        apiKey: "test-gemini-key",
        model: "gemini-2.0-flash",
        systemPrompt: "sys",
        userPrompt: "user",
      });

      expect(response).toContain("Missing pg in Gemini");
    });

    it("calls Grok completions correctly", async () => {
      globalThis.fetch = mock(async (url: any, opts: any) => {
        expect(url.toString()).toBe("https://api.x.ai/v1/chat/completions");
        expect(opts.headers.Authorization).toBe("Bearer test-grok-key");
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ summary: "Grok diagnosis" }) } }],
        }), { status: 200 });
      });

      const response = await callGrok({
        apiKey: "test-grok-key",
        model: "grok-2-latest",
        systemPrompt: "sys",
        userPrompt: "user",
      });

      expect(response).toContain("Grok diagnosis");
    });

    it("calls Claude messages correctly", async () => {
      globalThis.fetch = mock(async (url: any, opts: any) => {
        expect(url.toString()).toBe("https://api.anthropic.com/v1/messages");
        expect(opts.headers["x-api-key"]).toBe("test-claude-key");
        expect(opts.headers["anthropic-version"]).toBe("2023-06-01");
        return new Response(JSON.stringify({
          content: [{ text: JSON.stringify({ summary: "Claude diagnosis" }) }],
        }), { status: 200 });
      });

      const response = await callClaude({
        apiKey: "test-claude-key",
        model: "claude-3-5-sonnet-20241022",
        systemPrompt: "sys",
        userPrompt: "user",
      });

      expect(response).toContain("Claude diagnosis");
    });
  });

  describe("testAiConnection", () => {
    it("returns ok=true when ping succeeds", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          choices: [{ message: { content: "OK" } }],
        }), { status: 200 });
      });

      const result = await testAiConnection("openai", "sk-test", "gpt-4o-mini");
      expect(result.ok).toBe(true);
      expect(result.provider).toBe("openai");
      expect(result.message).toContain("Successfully connected");
    });

    it("returns ok=false when provider API errors", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          error: { message: "Invalid API key provided" },
        }), { status: 401 });
      });

      const result = await testAiConnection("openai", "sk-invalid", "gpt-4o-mini");
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Invalid API key");
    });
  });

  describe("diagnoseDeploymentFailure", () => {
    it("parses valid structured JSON diagnosis correctly", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: "TypeScript compilation error",
                rootCause: "Type 'string' is not assignable to type 'number'",
                explanation: "File src/index.ts has a type error on line 42",
                suggestedFixes: [
                  {
                    title: "Cast or parse to number",
                    description: "Use Number(value) instead of raw string",
                    actionType: "code",
                    snippet: "const id = Number(rawId);",
                  },
                ],
              }),
            },
          }],
        }), { status: 200 });
      });

      const { resolveProviderConfig } = await import("../diagnose");
      const { callOpenAi } = await import("../providers/openai");

      const config = await resolveProviderConfig("openai", "gpt-4o-mini", "sk-mock-key");
      const raw = await callOpenAi({
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt: "sys",
        userPrompt: "user",
      });

      const parsed = JSON.parse(raw);
      expect(parsed.summary).toBe("TypeScript compilation error");
      expect(parsed.rootCause).toContain("Type 'string'");
      expect(parsed.suggestedFixes.length).toBe(1);
      expect(parsed.suggestedFixes[0].snippet).toBe("const id = Number(rawId);");
    });
  });
});
