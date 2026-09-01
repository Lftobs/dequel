import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
	Sparkles,
	Terminal,
	FileCode,
	Sliders,
	Key,
	Copy,
	Check,
	RefreshCw,
	AlertTriangle,
	ArrowRight,
	Bot,
	Loader2,
} from "lucide-react";
import * as api from "../../../api/client";
import type { AiProvider, AiDiagnosis } from "../../../types";

interface AiBuildFixDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	deploymentId: string;
	projectName?: string;
	failureReason?: string | null;
}

const PROVIDERS: Array<{
	id: AiProvider;
	name: string;
	models: string[];
	iconColor: string;
}> = [
	{
		id: "openai",
		name: "OpenAI",
		models: ["gpt-4o-mini", "gpt-4o", "o3-mini"],
		iconColor: "text-emerald-400",
	},
	{
		id: "gemini",
		name: "Gemini",
		models: ["gemini-2.0-flash", "gemini-1.5-pro"],
		iconColor: "text-blue-400",
	},
	{
		id: "grok",
		name: "Grok",
		models: ["grok-2-latest", "grok-2"],
		iconColor: "text-purple-400",
	},
	{
		id: "claude",
		name: "Claude",
		models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
		iconColor: "text-amber-400",
	},
];

export function AiBuildFixDialog({
	open,
	onOpenChange,
	deploymentId,
	projectName,
	failureReason,
}: AiBuildFixDialogProps) {
	const { data: aiSettings } = useQuery({
		queryKey: ["aiSettings"],
		queryFn: () => api.getAiSettings().catch(() => null),
		enabled: open,
	});

	const { data: cachedDiagnosis, refetch: refetchCached } = useQuery({
		queryKey: ["aiDiagnosis", deploymentId],
		queryFn: () => api.getDeploymentAiDiagnosis(deploymentId).catch(() => null),
		enabled: open && !!deploymentId,
	});

	const [selectedProvider, setSelectedProvider] = useState<AiProvider>("openai");
	const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");
	const [apiKeyOverride, setApiKeyOverride] = useState<string>("");
	const [customPrompt, setCustomPrompt] = useState<string>("");

	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisError, setAnalysisError] = useState<string | null>(null);
	const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>(null);
	const [copiedSnippetIndex, setCopiedSnippetIndex] = useState<number | null>(null);
	const [showOptions, setShowOptions] = useState(false);

	useEffect(() => {
		if (aiSettings) {
			const prov = aiSettings.defaultProvider || "openai";
			setSelectedProvider(prov);
			const found = PROVIDERS.find((p) => p.id === prov);
			if (found && found.models.length > 0) {
				setSelectedModel(found.models[0]);
			}
		}
	}, [aiSettings]);

	useEffect(() => {
		if (cachedDiagnosis) {
			setDiagnosis(cachedDiagnosis);
		} else {
			setDiagnosis(null);
		}
	}, [cachedDiagnosis, deploymentId]);

	const handleProviderChange = (prov: AiProvider) => {
		setSelectedProvider(prov);
		const found = PROVIDERS.find((p) => p.id === prov);
		if (found && found.models.length > 0) {
			setSelectedModel(found.models[0]);
		}
	};

	const handleRunDiagnosis = async () => {
		setIsAnalyzing(true);
		setAnalysisError(null);
		try {
			const result = await api.diagnoseDeploymentFailure(deploymentId, {
				provider: selectedProvider,
				model: selectedModel,
				apiKey: apiKeyOverride.trim() || undefined,
				customPrompt: customPrompt.trim() || undefined,
			});
			setDiagnosis(result);
			refetchCached();
		} catch (err: any) {
			setAnalysisError(err.message || "AI build diagnosis failed. Please verify API keys or try another provider.");
		} finally {
			setIsAnalyzing(false);
		}
	};

	const handleCopy = (text: string, index: number) => {
		navigator.clipboard.writeText(text);
		setCopiedSnippetIndex(index);
		setTimeout(() => setCopiedSnippetIndex(null), 2500);
	};

	const getActionIcon = (actionType?: string) => {
		if (actionType === "command") return <Terminal className="h-3.5 w-3.5 text-blue-400" />;
		if (actionType === "code") return <FileCode className="h-3.5 w-3.5 text-emerald-400" />;
		if (actionType === "env") return <Key className="h-3.5 w-3.5 text-amber-400" />;
		return <Sliders className="h-3.5 w-3.5 text-purple-400" />;
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0a0a0e] border-border text-foreground p-4 sm:p-6 shadow-2xl">
				<DialogHeader className="space-y-1.5 pb-3 border-b border-border/50">
					<div className="flex items-center justify-between gap-2">
						<DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-primary animate-pulse" />
							AI Build Failure Diagnosis & Fix
						</DialogTitle>
						<Badge variant="outline" className="font-mono text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
							Failed Build
						</Badge>
					</div>
					<DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
						<span>Project: <strong className="text-foreground">{projectName || "Deployment"}</strong></span>
						<span>•</span>
						<span className="font-mono text-[11px]">ID: {deploymentId.slice(0, 8)}</span>
						{failureReason && (
							<>
								<span>•</span>
								<span className="text-red-400/90 truncate max-w-xs">{failureReason}</span>
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 pt-1">
					{/* Provider Selection Toolbar */}
					<div className="p-3 rounded-xl border border-border bg-[#0e0e13] space-y-3">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
							<span className="text-xs font-semibold text-muted-foreground">Select AI Provider:</span>
							<button
								type="button"
								onClick={() => setShowOptions(!showOptions)}
								className="text-[11px] text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
							>
								{showOptions ? "Hide Advanced Options" : "Advanced / Custom Prompt"}
							</button>
						</div>

						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
							{PROVIDERS.map((p) => {
								const isSelected = selectedProvider === p.id;
								return (
									<button
										key={p.id}
										type="button"
										onClick={() => handleProviderChange(p.id)}
										className={`px-3 py-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
											isSelected
												? "border-primary bg-primary/10 text-foreground font-semibold shadow-sm"
												: "border-border/60 bg-[#121217] text-muted-foreground hover:bg-[#181820] hover:text-foreground"
										}`}
									>
										<Bot className={`h-4 w-4 ${p.iconColor}`} />
										<span className="text-xs">{p.name}</span>
									</button>
								);
							})}
						</div>

						{showOptions && (
							<div className="space-y-3 pt-2 border-t border-border/40 text-xs">
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="space-y-1">
										<label className="text-[11px] text-muted-foreground font-medium">Model</label>
										<select
											value={selectedModel}
											onChange={(e) => setSelectedModel(e.target.value)}
											className="h-8 w-full rounded border border-border bg-[#15151c] px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
										>
											{PROVIDERS.find((p) => p.id === selectedProvider)?.models.map((m) => (
												<option key={m} value={m}>{m}</option>
											))}
										</select>
									</div>

									<div className="space-y-1">
										<label className="text-[11px] text-muted-foreground font-medium">
											Custom API Key (Optional Override)
										</label>
										<input
											type="password"
											placeholder="Leave blank to use saved key"
											value={apiKeyOverride}
											onChange={(e) => setApiKeyOverride(e.target.value)}
											className="h-8 w-full rounded border border-border bg-[#15151c] px-2.5 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
										/>
									</div>
								</div>

								<div className="space-y-1">
									<label className="text-[11px] text-muted-foreground font-medium">
										Additional Instructions for AI (Optional)
									</label>
									<textarea
										rows={2}
										placeholder="e.g. Focus on the Dockerfile build step or explain how to fix missing env variables"
										value={customPrompt}
										onChange={(e) => setCustomPrompt(e.target.value)}
										className="w-full rounded border border-border bg-[#15151c] p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
									/>
								</div>
							</div>
						)}

						<div className="flex items-center justify-between gap-2 pt-1">
							<span className="text-[11px] text-muted-foreground">
								Analyzes terminal output, Docker/Railpack compiler logs, and project metadata.
							</span>
							<Button
								onClick={handleRunDiagnosis}
								disabled={isAnalyzing}
								size="sm"
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-8 px-4 rounded-lg shadow"
							>
								{isAnalyzing ? (
									<>
										<Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
										Analyzing Logs...
									</>
								) : diagnosis ? (
									<>
										<RefreshCw className="h-3.5 w-3.5 mr-1.5" />
										Re-analyze
									</>
								) : (
									<>
										<Sparkles className="h-3.5 w-3.5 mr-1.5" />
										Diagnose Failure
									</>
								)}
							</Button>
						</div>
					</div>

					{/* Loading State */}
					{isAnalyzing && (
						<div className="p-8 rounded-xl border border-primary/20 bg-primary/5 text-center space-y-3">
							<Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
							<div className="space-y-1">
								<p className="text-sm font-semibold text-foreground">
									Analyzing build logs with {selectedProvider.toUpperCase()}...
								</p>
								<p className="text-xs text-muted-foreground">
									Isolating error traces, identifying missing packages, and formulating resolution steps.
								</p>
							</div>
						</div>
					)}

					{/* Error Banner */}
					{analysisError && !isAnalyzing && (
						<div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
							<div className="flex items-center gap-1.5 font-semibold">
								<AlertTriangle className="h-4 w-4" />
								<span>Analysis Error</span>
							</div>
							<p className="text-[11px] text-destructive/90">{analysisError}</p>
						</div>
					)}

					{/* Diagnosis Result View */}
					{diagnosis && !isAnalyzing && (
						<div className="space-y-4 animate-in fade-in-50 duration-300">
							{/* Summary Banner */}
							<div className="p-4 rounded-xl border border-border bg-[#0d0d12] space-y-2">
								<div className="flex items-center justify-between gap-2">
									<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
										Executive Summary
									</span>
									<Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-mono">
										{diagnosis.provider} ({diagnosis.model})
									</Badge>
								</div>
								<p className="text-sm font-semibold text-foreground leading-snug">
									{diagnosis.summary}
								</p>
							</div>

							{/* Root Cause Card */}
							<div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1.5">
								<div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
									<AlertTriangle className="h-4 w-4" />
									<span>Root Cause</span>
								</div>
								<p className="text-xs text-foreground/90 leading-relaxed font-mono bg-[#08080a] p-2.5 rounded-lg border border-border/40 whitespace-pre-wrap">
									{diagnosis.rootCause}
								</p>
							</div>

							{/* Explanation */}
							<div className="p-4 rounded-xl border border-border bg-[#0a0a0e] space-y-2">
								<span className="text-xs font-bold text-foreground">Why this occurred:</span>
								<p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
									{diagnosis.explanation}
								</p>
							</div>

							{/* Step-by-Step Fix Suggestions */}
							{diagnosis.suggestedFixes && diagnosis.suggestedFixes.length > 0 && (
								<div className="space-y-3 pt-1">
									<div className="flex items-center justify-between">
										<span className="text-xs font-bold text-foreground uppercase tracking-wider">
											Suggested Resolutions ({diagnosis.suggestedFixes.length})
										</span>
									</div>

									<div className="space-y-3">
										{diagnosis.suggestedFixes.map((fix, idx) => (
											<div
												key={idx}
												className="p-4 rounded-xl border border-border bg-[#0e0e13] space-y-2.5 transition-all hover:border-border/80"
											>
												<div className="flex items-center justify-between gap-2">
													<div className="flex items-center gap-2">
														<span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
															{idx + 1}
														</span>
														<span className="text-xs font-bold text-foreground">
															{fix.title}
														</span>
													</div>
													{fix.actionType && (
														<Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 flex items-center gap-1 bg-[#14141a] border-border">
															{getActionIcon(fix.actionType)}
															<span>{fix.actionType}</span>
														</Badge>
													)}
												</div>

												{fix.description && (
													<p className="text-xs text-muted-foreground leading-relaxed pl-7">
														{fix.description}
													</p>
												)}

												{fix.snippet && (
													<div className="ml-7 relative group">
														<pre className="p-3 rounded-lg bg-[#070709] border border-border/60 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre">
															{fix.snippet}
														</pre>
														<Button
															type="button"
															size="sm"
															variant="ghost"
															onClick={() => handleCopy(fix.snippet!, idx)}
															className="absolute right-2 top-2 h-7 px-2 text-[11px] bg-[#14141a]/90 hover:bg-[#202028] text-muted-foreground hover:text-foreground border border-border/40 rounded opacity-90 group-hover:opacity-100 transition-opacity flex items-center gap-1"
														>
															{copiedSnippetIndex === idx ? (
																<>
																	<Check className="h-3 w-3 text-emerald-400" />
																	<span className="text-emerald-400 text-[10px]">Copied</span>
																</>
															) : (
																<>
																	<Copy className="h-3 w-3" />
																	<span className="text-[10px]">Copy</span>
																</>
															)}
														</Button>
													</div>
												)}
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
