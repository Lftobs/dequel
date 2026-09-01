function stripAnsi(str: string): string {
  let s = str.replace(/[\u001b\u009b]\[[\d;]*[A-Za-z]/g, "");
  s = s.replace(/\[(\d+;)*\d*m/g, "");
  return s;
}

export interface DeploymentLogContext {
  deploymentId: string;
  projectName?: string;
  projectType?: string;
  buildType?: string;
  sourceType?: string;
  branch?: string | null;
  failureReason?: string | null;
  logs: Array<{ sequence: number; stage: string; message: string }>;
}

export function extractBuildErrorContext(ctx: DeploymentLogContext): string {
  const cleanLogs = ctx.logs.map((l) => ({
    stage: l.stage,
    message: stripAnsi(l.message).trim(),
  })).filter((l) => l.message.length > 0);

  const errorKeywords = [
    "error", "failed", "failure", "fatal", "exception", "cannot find module",
    "exit code", "err!", "command failed", "syntaxerror", "typeerror",
    "referenceerror", "not found", "permission denied", "build failed",
  ];

  let relevantLogs = cleanLogs;
  if (cleanLogs.length > 120) {
    const errorIndices: number[] = [];
    cleanLogs.forEach((l, idx) => {
      const lower = l.message.toLowerCase();
      if (errorKeywords.some((kw) => lower.includes(kw))) {
        errorIndices.push(idx);
      }
    });

    if (errorIndices.length > 0) {
      const firstError = Math.max(0, errorIndices[0] - 15);
      const lastError = Math.min(cleanLogs.length, errorIndices[errorIndices.length - 1] + 20);
      const windowLogs = cleanLogs.slice(firstError, lastError);
      if (windowLogs.length < 50) {
        relevantLogs = cleanLogs.slice(-100);
      } else {
        relevantLogs = windowLogs;
      }
    } else {
      relevantLogs = cleanLogs.slice(-100);
    }
  }

  const logLines = relevantLogs.map((l) => `[${l.stage}] ${l.message}`).join("\n");

  return [
    `Project: ${ctx.projectName || "Unknown"}`,
    `Project Type: ${ctx.projectType || "web"}`,
    `Build Strategy: ${ctx.buildType || "railpack"}`,
    `Source: ${ctx.sourceType || "git"}${ctx.branch ? ` (branch: ${ctx.branch})` : ""}`,
    ctx.failureReason ? `Failure Reason: ${ctx.failureReason}` : "",
    "",
    "--- BUILD & DEPLOYMENT LOGS ---",
    logLines || "(No logs recorded)",
  ].filter(Boolean).join("\n");
}

export const SYSTEM_PROMPT = `You are an expert DevOps, Docker, BuildKit, Railpack, and Cloud Deployment specialist for Dequel (a modern self-hosted deployment platform).
Your task is to analyze build, compilation, packaging, and container startup failures and provide clear, precise, and actionable diagnosis to the developer.

CRITICAL INSTRUCTIONS:
1. Identify the exact root cause from the logs (e.g. missing dependency, Node/Bun version incompatibility, wrong build script, missing environment variable, port binding error, syntax/type error, Dockerfile instruction issue).
2. Pinpoint the exact file, line number, package, or command if identifiable from the logs.
3. Provide step-by-step resolution instructions with copy-pasteable code snippets, command line commands, or configuration fixes.
4. Respond in valid JSON format matching this schema:
{
  "summary": "1-sentence executive summary of what failed",
  "rootCause": "Clear explanation of the exact failure mechanism",
  "explanation": "Detailed explanation of why this happened in this build environment and how Dequel/Docker ran into it",
  "suggestedFixes": [
    {
      "title": "Clear action title (e.g., Add missing dependency to package.json)",
      "description": "Step-by-step description of what to do",
      "actionType": "command" | "code" | "config" | "env",
      "snippet": "bun add pg\n# or\nnpm install pg"
    }
  ]
}

DO NOT include any text outside the JSON block. Return valid JSON only.`;
