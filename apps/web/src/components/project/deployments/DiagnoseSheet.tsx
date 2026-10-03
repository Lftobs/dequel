import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, HelpCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client";
import type { DiagCause, DiagRun, DiagStage } from "../../../types";
import { Button } from "../../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { DiagnosePipeline, STAGE_ORDER } from "./diagnose/DiagnosePipeline";
import { DiagnoseVerdict } from "./diagnose/DiagnoseVerdict";

interface DiagnoseSheetProps {
	deployment: { id: string; status: string; sourceType: string; failureReason: string | null };
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const payloadText = (payload: unknown, key: string): string => {
	if (payload && typeof payload === "object" && typeof (payload as Record<string, unknown>)[key] === "string") {
		return (payload as Record<string, string>)[key];
	}
	return "";
};

const payloadList = (payload: unknown, key: string): string[] => {
	if (payload && typeof payload === "object") {
		const value = (payload as Record<string, unknown>)[key];
		if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
	}
	return [];
};

export function DiagnoseSheet({ deployment, open, onOpenChange }: DiagnoseSheetProps) {
	const { data: keys, refetch: refetchKeys } = useQuery({
		queryKey: ["llm-keys"],
		queryFn: () => api.getLlmKeys(),
	});
	const configured = (keys ?? []).filter((k) => k.configured);
	const [provider, setProvider] = useState("");
	const [model, setModel] = useState("");
	const [run, setRun] = useState<DiagRun | null>(null);
	const [stages, setStages] = useState<DiagStage[]>([]);
	const [progress, setProgress] = useState<string[]>([]);
	const [starting, setStarting] = useState(false);
	const [running, setRunning] = useState(false);
	const [syncingModels, setSyncingModels] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [approving, setApproving] = useState<"pr" | null>(null);
	const [prUrl, setPrUrl] = useState<string | null>(null);
	const [slackPosted, setSlackPosted] = useState(false);
	const esRef = useRef<EventSource | null>(null);

	const activeProviderConfig = configured.find((k) => k.provider === provider);
	const cachedModels = activeProviderConfig?.models ?? [];
	const { data: defaultModels } = useQuery({
		queryKey: ["llm-default-models"],
		queryFn: () => api.getLlmDefaultModels(),
	});
	const modelOptions = cachedModels.length > 0 ? cachedModels : (defaultModels?.[provider] ?? []);

	useEffect(() => {
		if (configured.length > 0 && !provider) {
			const first = configured[0].provider;
			setProvider(first);
			const firstModels = configured[0].models?.length > 0 ? configured[0].models : (defaultModels?.[first] ?? []);
			setModel(firstModels[0] ?? "");
		}
	}, [configured, provider, defaultModels]);

	const pickProvider = (next: string) => {
		setProvider(next);
		const target = configured.find((k) => k.provider === next);
		const nextModels = target?.models?.length ? target.models : (defaultModels?.[next] ?? []);
		setModel(nextModels[0] ?? "");
	};

	const handleSyncModels = async () => {
		if (!provider) return;
		setSyncingModels(true);
		setError(null);
		try {
			const res = await api.syncLlmModels(provider);
			await refetchKeys();
			if (res.models.length > 0 && (!model || !res.models.includes(model))) {
				setModel(res.models[0]);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to sync provider models");
		} finally {
			setSyncingModels(false);
		}
	};

	useEffect(() => {
		if (!open) {
			esRef.current?.close();
			esRef.current = null;
			setRun(null);
			setStages([]);
			setProgress([]);
			setError(null);
			setStarting(false);
			setRunning(false);
			setPrUrl(null);
			setSlackPosted(false);
		}
		return () => {
			esRef.current?.close();
			esRef.current = null;
		};
	}, [open]);

	const attach = (runId: string) => {
		setRunning(true);
		const es = new EventSource(api.streamDiagnosisUrl(runId));
		esRef.current = es;
		es.addEventListener("stage", (e) => {
			try {
				const data = JSON.parse((e as MessageEvent).data) as { stage: string; payload: unknown };
				setStages((prev) => {
					const rest = prev.filter((s) => s.stage !== data.stage);
					return [...rest, { stage: data.stage, payload: data.payload }].sort(
						(a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
					);
				});
			} catch {}
		});
		const finish = async () => {
			es.close();
			esRef.current = null;
			setRunning(false);
			try {
				const full = await api.getDiagnosis(runId);
				setRun(full.run);
				setStages(full.stages);
				setSlackPosted(!!full.slackPosted);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load diagnosis results");
			}
		};
		es.addEventListener("done", () => void finish());
		es.addEventListener("error", () => void finish());
		es.addEventListener("token", (e) => {
			try {
				const data = JSON.parse((e as MessageEvent).data) as { stage: string; delta: string };
				if (typeof data.delta === "string" && data.delta.trim()) {
					setProgress((prev) => [...prev.slice(-29), data.delta.trim()]);
				}
			} catch {}
		});
		es.onerror = () => {};
	};

	const start = async () => {
		if (!provider || !model.trim()) {
			setError("Select an AI provider and model before diagnosing.");
			return;
		}
		setError(null);
		setStarting(true);
		try {
			const started = await api.startDiagnosis(deployment.id, { provider, model: model.trim() });
			setRun(started);
			if (started.status === "done" || started.status === "error") {
				const full = await api.getDiagnosis(started.id);
				setRun(full.run);
				setStages(full.stages);
				setSlackPosted(!!full.slackPosted);
			} else {
				attach(started.id);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start diagnosis");
		} finally {
			setStarting(false);
		}
	};

	const approvePr = async () => {
		if (!run) return;
		setApproving("pr");
		setError(null);
		try {
			const res = await api.approveFixPr(run.id, crypto.randomUUID());
			setPrUrl(res.prUrl);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create fix PR");
		} finally {
			setApproving(null);
		}
	};

	const cause: DiagCause | null = run?.report?.cause ?? run?.cause ?? null;
	const explainStage = stages.find((s) => s.stage === "explain")?.payload;
	const investigateStage = stages.find((s) => s.stage === "investigate")?.payload;
	const dequelVersion =
		investigateStage && typeof investigateStage === "object"
			? String((investigateStage as Record<string, unknown>).dequelRev ?? "")
			: "";
	const dequelStale =
		investigateStage && typeof investigateStage === "object"
			? (investigateStage as Record<string, unknown>).dequelStale === true
			: false;
	const summary = payloadText(explainStage, "summary");
	const fixSteps = payloadList(explainStage, "fixSteps");
	const userFix = run?.report?.userFix;
	const dequelReport = run?.report?.dequelReport;
	const isGit = deployment.sourceType === "git";

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="max-w-2xl overflow-y-auto sm:max-w-2xl w-full">
				<SheetHeader className="pb-4 border-b border-border/40">
					<div className="flex items-center gap-2">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
							<Sparkles className="h-4 w-4" />
						</div>
						<div className="flex-1">
							<SheetTitle className="text-base font-semibold">
								Diagnose Build Failure — {deployment.id.slice(0, 8)}
							</SheetTitle>
							<SheetDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
								AI-driven root cause analysis and automated fix generation
							</SheetDescription>
						</div>
					</div>

					{deployment.failureReason && (
						<div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-300">
							<AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
							<span className="font-mono break-all">{deployment.failureReason}</span>
						</div>
					)}
				</SheetHeader>

				<div className="mt-5 space-y-5">
					{configured.length === 0 ? (
						<div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-muted-foreground space-y-2">
							<p className="font-medium text-amber-300 flex items-center gap-1.5">
								<AlertCircle className="h-4 w-4" /> No AI Provider Configured
							</p>
							<p>
								To run build failure diagnoses, configure an API key for OpenAI, Anthropic, Gemini, Groq, or Ollama
								under Platform Settings.
							</p>
						</div>
					) : (
						<div className="rounded-xl border border-border/60 bg-card/60 p-3.5 space-y-3 shadow-sm">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
								<div className="space-y-1">
									<label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
										Provider
									</label>
									<Select value={provider} onValueChange={pickProvider} disabled={starting || running}>
										<SelectTrigger className="h-9 text-xs bg-background">
											<SelectValue placeholder="Select provider" />
										</SelectTrigger>
										<SelectContent>
											{configured.map((k) => (
												<SelectItem key={k.provider} value={k.provider}>
													<span className="font-medium capitalize">{k.provider}</span>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<div className="flex items-center justify-between">
										<label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
											Model
										</label>
										<span className="text-[10px] text-muted-foreground font-mono">{modelOptions.length} available</span>
									</div>
									<div className="flex items-center gap-1.5">
										<Select value={model} onValueChange={setModel} disabled={starting || running}>
											<SelectTrigger className="h-9 text-xs font-mono bg-background flex-1">
												<SelectValue placeholder="Select a model..." />
											</SelectTrigger>
											<SelectContent className="max-h-60">
												{modelOptions.map((m) => (
													<SelectItem key={m} value={m}>
														<span className="font-mono text-xs">{m}</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>

										<Button
											type="button"
											variant="outline"
											size="icon"
											title="Sync models from provider"
											onClick={handleSyncModels}
											disabled={syncingModels || starting || running}
											className="h-9 w-9 shrink-0 text-muted-foreground hover:text-orange-400"
										>
											<RefreshCw className={`h-3.5 w-3.5 ${syncingModels ? "animate-spin" : ""}`} />
										</Button>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-between pt-1 border-t border-border/30">
								<span className="text-[11px] text-muted-foreground flex items-center gap-1">
									<HelpCircle className="h-3 w-3" /> Runs in an isolated read-only sandbox
								</span>
								<Button
									size="sm"
									onClick={start}
									disabled={starting || running || !model}
									className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs px-4 h-8 gap-1.5"
								>
									{starting ? (
										<>
											<Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…
										</>
									) : running ? (
										<>
											<Loader2 className="h-3.5 w-3.5 animate-spin" /> Diagnosing…
										</>
									) : run ? (
										<>
											<RefreshCw className="h-3.5 w-3.5" /> Re-Diagnose
										</>
									) : (
										<>
											<Sparkles className="h-3.5 w-3.5" /> Diagnose Failure
										</>
									)}
								</Button>
							</div>
						</div>
					)}

					{error && (
						<div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{(running || stages.length > 0) && <DiagnosePipeline stages={stages} running={running} progress={progress} />}

					{run?.status === "done" && cause && (
						<DiagnoseVerdict
							cause={cause}
							summary={summary}
							fixSteps={fixSteps}
							userFix={userFix}
							dequelReport={dequelReport}
							dequelVersion={dequelVersion}
							dequelStale={dequelStale}
							slackPosted={slackPosted}
							isGit={isGit}
							prUrl={prUrl}
							approving={approving}
							onApprovePr={approvePr}
						/>
					)}

					{run?.status === "error" && (
						<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span>Diagnosis failed: {run.error ?? "unknown error occurred"}</span>
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
