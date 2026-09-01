import { apiFetch } from "./core";
import type {
	AiSettingsStatus,
	AiSettingsInput,
	AiDiagnosis,
	AiProvider,
} from "../types";

export const getAiSettings = () =>
	apiFetch<AiSettingsStatus>("/settings/ai");

export const updateAiSettings = (data: AiSettingsInput) =>
	apiFetch<void>("/settings/ai", {
		method: "PUT",
		body: JSON.stringify(data),
	});

export const testAiConnection = (data: {
	provider: AiProvider;
	apiKey?: string;
	model?: string;
}) =>
	apiFetch<{ ok: boolean; message: string; provider: AiProvider; model: string }>(
		"/settings/ai/test",
		{
			method: "POST",
			body: JSON.stringify(data),
		},
	);

export const diagnoseDeploymentFailure = (
	deploymentId: string,
	options?: {
		provider?: AiProvider;
		model?: string;
		apiKey?: string;
		customPrompt?: string;
	},
) =>
	apiFetch<AiDiagnosis>(`/deployments/${deploymentId}/ai-diagnose`, {
		method: "POST",
		body: JSON.stringify(options || {}),
	});

export const getDeploymentAiDiagnosis = (deploymentId: string) =>
	apiFetch<AiDiagnosis | null>(`/deployments/${deploymentId}/ai-diagnosis`);
