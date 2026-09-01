import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Sparkles, Check, AlertCircle } from "lucide-react";
import * as api from "../../api/client";
import { ProviderConfigCard } from "./ai/ProviderConfigCard";
import type { AiProvider } from "../../types";

const PROVIDER_OPTIONS: Array<{
	id: AiProvider;
	name: string;
	desc: string;
	iconColor: string;
	models: Array<{ value: string; label: string }>;
}> = [
	{
		id: "openai",
		name: "OpenAI",
		desc: "GPT-4o, GPT-4o-mini & Reasoning models",
		iconColor: "text-emerald-400",
		models: [
			{ value: "gpt-4o-mini", label: "gpt-4o-mini (Fast & Cost Efficient)" },
			{ value: "gpt-4o", label: "gpt-4o (High Intelligence)" },
			{ value: "gpt-4-turbo", label: "gpt-4-turbo" },
			{ value: "o3-mini", label: "o3-mini (Reasoning)" },
			{ value: "o1-mini", label: "o1-mini (Reasoning)" },
		],
	},
	{
		id: "gemini",
		name: "Google Gemini",
		desc: "Gemini 2.0 Flash & Gemini 1.5 Pro",
		iconColor: "text-blue-400",
		models: [
			{ value: "gemini-2.0-flash", label: "gemini-2.0-flash (Ultra Fast & Smart)" },
			{ value: "gemini-1.5-flash", label: "gemini-1.5-flash" },
			{ value: "gemini-1.5-pro", label: "gemini-1.5-pro (Deep Reasoning)" },
		],
	},
	{
		id: "grok",
		name: "xAI Grok",
		desc: "Grok-2 & Grok Beta models",
		iconColor: "text-purple-400",
		models: [
			{ value: "grok-2-latest", label: "grok-2-latest" },
			{ value: "grok-2", label: "grok-2" },
			{ value: "grok-beta", label: "grok-beta" },
		],
	},
	{
		id: "claude",
		name: "Anthropic Claude",
		desc: "Claude 3.5 Sonnet & Claude 3.5 Haiku",
		iconColor: "text-amber-400",
		models: [
			{ value: "claude-3-5-sonnet-20241022", label: "claude-3-5-sonnet-20241022 (Recommended)" },
			{ value: "claude-3-5-haiku-20241022", label: "claude-3-5-haiku-20241022 (Fast)" },
			{ value: "claude-3-opus-20240229", label: "claude-3-opus-20240229" },
		],
	},
];

export function AiIntegrationSection() {
	const { data: status, refetch } = useQuery({
		queryKey: ["aiSettings"],
		queryFn: () => api.getAiSettings().catch(() => null),
	});

	const [defaultProvider, setDefaultProvider] = useState<AiProvider>("openai");

	const [openaiKey, setOpenaiKey] = useState("");
	const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");

	const [geminiKey, setGeminiKey] = useState("");
	const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash");

	const [grokKey, setGrokKey] = useState("");
	const [grokModel, setGrokModel] = useState("grok-2-latest");

	const [claudeKey, setClaudeKey] = useState("");
	const [claudeModel, setClaudeModel] = useState("claude-3-5-sonnet-20241022");

	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);

	const [testingProvider, setTestingProvider] = useState<AiProvider | null>(null);
	const [testResult, setTestResult] = useState<{
		provider: AiProvider;
		ok: boolean;
		message: string;
	} | null>(null);

	useEffect(() => {
		if (status) {
			setDefaultProvider(status.defaultProvider || "openai");
			if (status.openaiModel) setOpenaiModel(status.openaiModel);
			if (status.geminiModel) setGeminiModel(status.geminiModel);
			if (status.grokModel) setGrokModel(status.grokModel);
			if (status.claudeModel) setClaudeModel(status.claudeModel);
		}
	}, [status]);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSaving(true);
		setSaveSuccess(false);
		try {
			await api.updateAiSettings({
				defaultProvider,
				openaiApiKey: openaiKey.trim() || undefined,
				openaiModel,
				geminiApiKey: geminiKey.trim() || undefined,
				geminiModel,
				grokApiKey: grokKey.trim() || undefined,
				grokModel,
				claudeApiKey: claudeKey.trim() || undefined,
				claudeModel,
			});
			setSaveSuccess(true);
			setOpenaiKey("");
			setGeminiKey("");
			setGrokKey("");
			setClaudeKey("");
			refetch();
			setTimeout(() => setSaveSuccess(false), 4000);
		} finally {
			setIsSaving(false);
		}
	};

	const handleTest = async (provider: AiProvider) => {
		setTestingProvider(provider);
		setTestResult(null);

		let apiKey = "";
		let model = "";
		if (provider === "openai") {
			apiKey = openaiKey.trim();
			model = openaiModel;
		} else if (provider === "gemini") {
			apiKey = geminiKey.trim();
			model = geminiModel;
		} else if (provider === "grok") {
			apiKey = grokKey.trim();
			model = grokModel;
		} else if (provider === "claude") {
			apiKey = claudeKey.trim();
			model = claudeModel;
		}

		try {
			const res = await api.testAiConnection({
				provider,
				apiKey: apiKey || undefined,
				model: model || undefined,
			});
			setTestResult({ provider, ok: true, message: res.message });
		} catch (err: any) {
			setTestResult({
				provider,
				ok: false,
				message: err.message || `Failed to test ${provider}`,
			});
		} finally {
			setTestingProvider(null);
		}
	};

	const isConfigured = (p: AiProvider) => {
		if (!status) return false;
		if (p === "openai") return status.openaiConfigured;
		if (p === "gemini") return status.geminiConfigured;
		if (p === "grok") return status.grokConfigured;
		if (p === "claude") return status.claudeConfigured;
		return false;
	};

	return (
		<Card className="bg-card/40 border-border backdrop-blur-sm">
			<CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2">
				<div className="space-y-1">
					<CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
						<Sparkles className="h-5 w-5 text-primary" /> AI Build Failure Fix & Diagnostics
					</CardTitle>
					<p className="text-xs text-muted-foreground">
						Connect AI providers (OpenAI, Gemini, Grok, Claude) to automatically analyze build errors and generate step-by-step fixes.
					</p>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				<form onSubmit={handleSave} className="space-y-6">
					<div className="space-y-3">
						<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Default AI Provider
						</label>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
							{PROVIDER_OPTIONS.map((prov) => {
								const configured = isConfigured(prov.id);
								const isSelected = defaultProvider === prov.id;
								return (
									<button
										key={prov.id}
										type="button"
										onClick={() => setDefaultProvider(prov.id)}
										className={`p-3.5 rounded-xl border text-left transition-all relative ${
											isSelected
												? "border-primary bg-primary/5 shadow-md shadow-primary/5"
												: "border-border bg-[#0d0d11] hover:border-border/80 hover:bg-[#121217]"
										}`}
									>
										<div className="flex items-center justify-between mb-1.5">
											<span className={`text-xs font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
												{prov.name}
											</span>
											{configured ? (
												<Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 py-0">
													Ready
												</Badge>
											) : (
												<Badge variant="outline" className="text-[9px] bg-muted/20 text-muted-foreground border-muted px-1.5 py-0">
													Not Set
												</Badge>
											)}
										</div>
										<p className="text-[11px] text-muted-foreground leading-tight line-clamp-1">
											{prov.desc}
										</p>
									</button>
								);
							})}
						</div>
					</div>

					<div className="space-y-4 pt-2">
						<ProviderConfigCard
							provider="openai"
							name="OpenAI"
							configured={!!status?.openaiConfigured}
							iconColor="text-emerald-400"
							apiKey={openaiKey}
							onApiKeyChange={setOpenaiKey}
							model={openaiModel}
							onModelChange={setOpenaiModel}
							models={PROVIDER_OPTIONS[0].models}
							onTest={() => handleTest("openai")}
							isTesting={testingProvider === "openai"}
						/>

						<ProviderConfigCard
							provider="gemini"
							name="Google Gemini"
							configured={!!status?.geminiConfigured}
							iconColor="text-blue-400"
							apiKey={geminiKey}
							onApiKeyChange={setGeminiKey}
							model={geminiModel}
							onModelChange={setGeminiModel}
							models={PROVIDER_OPTIONS[1].models}
							onTest={() => handleTest("gemini")}
							isTesting={testingProvider === "gemini"}
						/>

						<ProviderConfigCard
							provider="grok"
							name="xAI Grok"
							configured={!!status?.grokConfigured}
							iconColor="text-purple-400"
							apiKey={grokKey}
							onApiKeyChange={setGrokKey}
							model={grokModel}
							onModelChange={setGrokModel}
							models={PROVIDER_OPTIONS[2].models}
							onTest={() => handleTest("grok")}
							isTesting={testingProvider === "grok"}
						/>

						<ProviderConfigCard
							provider="claude"
							name="Anthropic Claude"
							configured={!!status?.claudeConfigured}
							iconColor="text-amber-400"
							apiKey={claudeKey}
							onApiKeyChange={setClaudeKey}
							model={claudeModel}
							onModelChange={setClaudeModel}
							models={PROVIDER_OPTIONS[3].models}
							onTest={() => handleTest("claude")}
							isTesting={testingProvider === "claude"}
						/>
					</div>

					{testResult && (
						<div
							className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
								testResult.ok
									? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
									: "bg-destructive/10 border-destructive/20 text-destructive"
							}`}
						>
							{testResult.ok ? (
								<Check className="h-4 w-4 shrink-0" />
							) : (
								<AlertCircle className="h-4 w-4 shrink-0" />
							)}
							<span>{testResult.message}</span>
						</div>
					)}

					<div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/40">
						{saveSuccess ? (
							<span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
								<Check className="h-3.5 w-3.5" /> Settings saved successfully
							</span>
						) : (
							<span className="text-xs text-muted-foreground">
								Keys are stored securely with AES-256-GCM encryption.
							</span>
						)}
						<Button
							type="submit"
							disabled={isSaving}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 px-6 rounded-lg w-full sm:w-auto shadow-md"
						>
							{isSaving ? "Saving..." : "Save AI Settings"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
