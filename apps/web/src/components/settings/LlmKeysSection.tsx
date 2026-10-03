import { useQuery } from "@tanstack/react-query";
import {
	AlertCircle,
	Check,
	CheckCircle2,
	ExternalLink,
	Eye,
	EyeOff,
	Layers,
	RefreshCw,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ConfiguredProvidersList } from "./llm/ConfiguredProvidersList";
import { PROVIDERS } from "./llm/types";

export function LlmKeysSection() {
	const { data, refetch, isLoading } = useQuery({
		queryKey: ["llm-keys"],
		queryFn: () => api.getLlmKeys(),
	});

	const [provider, setProvider] = useState<string>("openai");
	const [apiKey, setApiKey] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [baseURL, setBaseURL] = useState("");
	const [saveResult, setSaveResult] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [syncingProvider, setSyncingProvider] = useState<string | null>(null);

	const configured = data?.filter((k) => k.configured) ?? [];
	const currentStatus = data?.find((k) => k.provider === provider);
	const currentMeta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

	useEffect(() => {
		setBaseURL(currentStatus?.baseUrl ?? currentMeta.defaultBaseUrl ?? "");
		setApiKey("");
		setSaveResult(null);
	}, [provider, currentStatus?.baseUrl, currentMeta.defaultBaseUrl]);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaveResult(null);
		setSaving(true);
		try {
			const updated = await api.setLlmKey({
				provider,
				apiKey: apiKey.trim() || undefined,
				baseURL: baseURL.trim() || undefined,
			});
			setApiKey("");
			await refetch();
			const modelCount = updated.models?.length ?? 0;
			setSaveResult(
				modelCount > 0
					? `Saved successfully. Auto-discovered and cached ${modelCount} models from ${currentMeta.label}.`
					: `Saved provider key for ${currentMeta.label}.`,
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setSaveResult(`error: ${message}`);
		} finally {
			setSaving(false);
		}
	};

	const handleSync = async (targetProvider: string) => {
		setSyncingProvider(targetProvider);
		setSaveResult(null);
		try {
			const res = await api.syncLlmModels(targetProvider);
			await refetch();
			const meta = PROVIDERS.find((p) => p.id === targetProvider);
			setSaveResult(`Synced ${res.models.length} models from ${meta?.label ?? targetProvider}.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to sync models";
			setSaveResult(`error: ${message}`);
		} finally {
			setSyncingProvider(null);
		}
	};

	const remove = async (p: string) => {
		setSaveResult(null);
		try {
			await api.deleteLlmKey(p);
			await refetch();
			const meta = PROVIDERS.find((pr) => pr.id === p);
			setSaveResult(`Provider "${meta?.label ?? p}" removed.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setSaveResult(`error: ${message}`);
		}
	};

	const startEditing = (p: string) => {
		setProvider(p);
		const target = data?.find((k) => k.provider === p);
		if (target) {
			setBaseURL(target.baseUrl ?? "");
		}
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<div className="space-y-6">
			{/* Main Settings Card */}
			<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
				<CardHeader className="border-b border-border/40 pb-5">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20 shrink-0">
								<Sparkles className="h-5 w-5" />
							</div>
							<div>
								<div className="flex items-center gap-2 flex-wrap">
									<CardTitle className="text-lg font-semibold text-foreground">AI Diagnosis Providers</CardTitle>
									{configured.length > 0 ? (
										<Badge
											variant="success"
											className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 text-[10px]"
										>
											<ShieldCheck className="h-3 w-3" /> {configured.length} Active{" "}
											{configured.length === 1 ? "Provider" : "Providers"}
										</Badge>
									) : (
										<Badge variant="warning" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
											Not Configured
										</Badge>
									)}
								</div>
								<p className="text-xs text-muted-foreground mt-0.5">
									Keys used by the automated failure diagnosis agent. Models are auto-pulled directly from each provider
									and cached for one-click selection.
								</p>
							</div>
						</div>

						{currentMeta.docsUrl && (
							<a
								href={currentMeta.docsUrl}
								target="_blank"
								rel="noreferrer"
								className="text-xs text-orange-400 hover:text-orange-300 inline-flex items-center gap-1 self-start sm:self-auto hover:underline"
							>
								Get API Key <ExternalLink className="h-3 w-3" />
							</a>
						)}
					</div>
				</CardHeader>

				<CardContent className="pt-6 space-y-6">
					<form onSubmit={save} className="space-y-4">
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">AI Provider</label>
								<Select value={provider} onValueChange={setProvider}>
									<SelectTrigger className="bg-card border-border/80 text-xs">
										<SelectValue placeholder="Select provider" />
									</SelectTrigger>
									<SelectContent>
										{PROVIDERS.map((p) => {
											const isCfg = configured.some((c) => c.provider === p.id);
											return (
												<SelectItem key={p.id} value={p.id}>
													<div className="flex items-center justify-between gap-2 w-full">
														<span className="font-medium">{p.label}</span>
														{isCfg && <span className="text-[10px] text-emerald-400 font-mono">active</span>}
													</div>
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>
								<p className="text-[11px] text-muted-foreground">{currentMeta.desc}</p>
							</div>

							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<label className="text-xs font-medium text-foreground">API Key</label>
									{currentStatus?.configured && (
										<span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
											<Check className="h-3 w-3" /> Key saved
										</span>
									)}
								</div>
								<div className="relative flex items-center">
									<Input
										type={showKey ? "text" : "password"}
										placeholder={
											currentStatus?.configured ? "•••••••••••••••• (leave blank to keep)" : currentMeta.keyPlaceholder
										}
										value={apiKey}
										onChange={(e) => setApiKey(e.target.value)}
										className="bg-card border-border/80 text-xs font-mono pr-10 focus:ring-orange-500/50"
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => setShowKey(!showKey)}
										className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
									>
										{showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
									</Button>
								</div>
								<p className="text-[11px] text-muted-foreground">
									{provider === "ollama"
										? "Optional when Ollama runs on your host without authentication."
										: "Encrypted at rest using AES-256-GCM."}
								</p>
							</div>
						</div>

						{(provider === "custom" || provider === "ollama" || currentStatus?.baseUrl) && (
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Base URL (OpenAI-compatible endpoint)</label>
								<Input
									value={baseURL}
									onChange={(e) => setBaseURL(e.target.value)}
									placeholder={currentMeta.defaultBaseUrl || "https://api.your-endpoint.com/v1"}
									className="bg-card border-border/80 text-xs font-mono focus:ring-orange-500/50"
								/>
								<p className="text-[11px] text-muted-foreground">
									{provider === "ollama"
										? "Default: http://host.docker.internal:11435/v1 for Docker bridge network access."
										: "Base endpoint prefix where /models and /chat/completions are hosted."}
								</p>
							</div>
						)}

						{/* Cached Models Preview for selected provider */}
						{currentStatus?.configured && (
							<div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
								<div className="flex items-center justify-between flex-wrap gap-2">
									<div className="flex items-center gap-2">
										<Layers className="h-3.5 w-3.5 text-orange-400" />
										<span className="text-xs font-semibold text-foreground">Auto-Discovered Models</span>
										<Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-border/80">
											{currentStatus.models?.length ?? 0} cached
										</Badge>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => handleSync(provider)}
										disabled={syncingProvider === provider}
										className="h-7 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1.5"
									>
										<RefreshCw className={`h-3 w-3 ${syncingProvider === provider ? "animate-spin" : ""}`} />
										{syncingProvider === provider ? "Syncing..." : "Sync Models Now"}
									</Button>
								</div>

								{currentStatus.models && currentStatus.models.length > 0 ? (
									<div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
										{currentStatus.models.map((m) => (
											<span
												key={m}
												className="rounded-md border border-border/70 bg-card/80 px-2 py-0.5 text-[11px] font-mono text-foreground/90 shadow-sm"
											>
												{m}
											</span>
										))}
									</div>
								) : (
									<p className="text-xs text-muted-foreground">
										No models currently cached. Click "Save & Sync Models" or "Sync Models Now" to pull them
										automatically.
									</p>
								)}
							</div>
						)}

						<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
							{saveResult ? (
								<p
									className={`text-xs font-medium flex items-center gap-1.5 ${
										saveResult.startsWith("error") ? "text-red-400" : "text-emerald-400"
									}`}
								>
									{saveResult.startsWith("error") ? (
										<AlertCircle className="h-3.5 w-3.5 shrink-0" />
									) : (
										<CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
									)}
									<span>{saveResult}</span>
								</p>
							) : (
								<span />
							)}
							<Button
								type="submit"
								size="sm"
								disabled={saving}
								className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs px-5 shadow-md w-full sm:w-auto gap-1.5"
							>
								{saving ? (
									<>
										<RefreshCw className="h-3.5 w-3.5 animate-spin" />
										Saving & Syncing Models…
									</>
								) : (
									<>
										<Sparkles className="h-3.5 w-3.5" />
										Save & Sync Models
									</>
								)}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			{/* Configured Providers List */}
			<ConfiguredProvidersList
				configured={configured}
				isLoading={isLoading}
				syncingProvider={syncingProvider}
				onSync={handleSync}
				onEdit={startEditing}
				onRemove={remove}
			/>
		</div>
	);
}
