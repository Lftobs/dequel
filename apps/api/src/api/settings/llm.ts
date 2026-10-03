import { Elysia } from "elysia";
import {
	LLM_PROVIDERS,
	deleteLlmKey,
	getDecryptedLlmKey,
	getLlmKeyStatus,
	updateLlmModels,
	upsertLlmKey,
} from "../../db/repo";
import { fetchProviderModels, DEFAULT_PROVIDER_MODELS } from "../../fixdiag/provider-models";
import { fail, ok } from "../response";

export const llmSettingsRoutes = new Elysia({ prefix: "/settings" })
	.get("/llm-keys", async () => ok(await getLlmKeyStatus()))
	.get("/llm-default-models", async () => ok(DEFAULT_PROVIDER_MODELS))
	.get("/llm-keys/:provider/models", async ({ params, query, set }: any) => {
		const provider = String(params.provider);
		if (!(LLM_PROVIDERS as readonly string[]).includes(provider)) {
			set.status = 400;
			return fail(`provider must be one of: ${LLM_PROVIDERS.join(", ")}`);
		}
		const existing = await getDecryptedLlmKey(provider);
		if (!existing) {
			set.status = 404;
			return fail("Provider key not configured");
		}
		const refresh = query?.refresh === "true" || existing.models.length === 0;
		if (refresh) {
			const models = await fetchProviderModels({
				provider,
				apiKey: existing.apiKey,
				baseUrl: existing.baseUrl,
			});
			if (models.length > 0) {
				await updateLlmModels(provider, models);
				return ok({ provider, models, cached: false });
			}
		}
		return ok({ provider, models: existing.models, cached: true });
	})
	.post("/llm-keys/:provider/sync", async ({ params, set }: any) => {
		const provider = String(params.provider);
		if (!(LLM_PROVIDERS as readonly string[]).includes(provider)) {
			set.status = 400;
			return fail(`provider must be one of: ${LLM_PROVIDERS.join(", ")}`);
		}
		const existing = await getDecryptedLlmKey(provider);
		if (!existing) {
			set.status = 404;
			return fail("Provider key not configured");
		}
		const models = await fetchProviderModels({
			provider,
			apiKey: existing.apiKey,
			baseUrl: existing.baseUrl,
		});
		await updateLlmModels(provider, models);
		return ok({ provider, models }, `Synced ${models.length} models for ${provider}`);
	})
	.put("/llm-keys", async ({ body, set }: any) => {
		const provider = String(body?.provider ?? "");
		if (!(LLM_PROVIDERS as readonly string[]).includes(provider)) {
			set.status = 400;
			return fail(`provider must be one of: ${LLM_PROVIDERS.join(", ")}`);
		}
		if (body?.apiKey !== undefined && typeof body.apiKey !== "string") {
			set.status = 400;
			return fail("apiKey must be a string");
		}
		const existing = await getDecryptedLlmKey(provider);
		if (provider === "custom") {
			if (!body?.baseURL && !existing?.baseUrl) {
				set.status = 400;
				return fail("baseURL is required for the custom provider");
			}
		}
		const apiKey =
			typeof body?.apiKey === "string" && body.apiKey.length > 0 ? body.apiKey : provider === "ollama" ? "ollama" : "";
		const effectiveBaseUrl = body?.baseURL !== undefined ? body.baseURL : existing?.baseUrl;
		const baseChanged = body?.baseURL !== undefined && body.baseURL !== existing?.baseUrl;
		if (baseChanged && !apiKey && existing?.apiKey) {
			set.status = 400;
			return fail("apiKey is required when changing baseURL");
		}
		const effectiveApiKey = apiKey || existing?.apiKey || "";

		let models: string[] | undefined = Array.isArray(body?.models) ? body.models.map(String) : undefined;
		if (!models || models.length === 0) {
			try {
				const pulled = await fetchProviderModels({
					provider,
					apiKey: effectiveApiKey,
					baseUrl: effectiveBaseUrl,
				});
				if (pulled.length > 0) {
					models = pulled;
				}
			} catch {
				models = existing?.models ?? undefined;
			}
		}

		const status = await upsertLlmKey({
			provider,
			apiKey,
			baseURL: body?.baseURL,
			models,
		});
		return ok(status, "LLM provider key updated");
	})
	.delete("/llm-keys/:provider", async ({ params, set }: any) => {
		const deleted = await deleteLlmKey(String(params.provider));
		if (!deleted) {
			set.status = 404;
			return fail("LLM provider key not found");
		}
		return ok(null, "LLM provider key deleted");
	});
