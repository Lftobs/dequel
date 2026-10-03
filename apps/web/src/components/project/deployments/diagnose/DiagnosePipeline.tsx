import { CheckCircle2, Circle, Loader2, Terminal } from "lucide-react";
import type { DiagStage } from "../../../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";

export const STAGE_LABELS: Record<string, { label: string; desc: string }> = {
	triage: { label: "Triage Failure", desc: "Analyzing build logs & failure signals" },
	investigate: { label: "Sandbox Investigation", desc: "Inspecting source code in isolated sandbox" },
	explain: { label: "Explain Root Cause", desc: "Identifying failure reason and categorization" },
	propose: { label: "Draft Fix & Proposal", desc: "Generating code patches & remediation steps" },
};

export const STAGE_ORDER = ["triage", "investigate", "explain", "propose"];

interface DiagnosePipelineProps {
	stages: DiagStage[];
	running: boolean;
	progress: string[];
}

export function DiagnosePipeline({ stages, running, progress }: DiagnosePipelineProps) {
	return (
		<Card className="border-border/60 bg-card/60 overflow-hidden shadow-sm">
			<CardHeader className="py-3 px-4 border-b border-border/30">
				<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
					<span>Investigation Pipeline</span>
					{running && (
						<span className="flex items-center gap-1 text-[11px] font-normal text-orange-400 lowercase">
							<span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-ping" />
							In progress
						</span>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-4 space-y-4">
				<div className="space-y-2.5">
					{STAGE_ORDER.map((stageKey) => {
						const done = stages.some((s) => s.stage === stageKey);
						const isCurrentActive = running && !done && STAGE_ORDER.findIndex((s) => s === stageKey) === stages.length;
						const stageInfo = STAGE_LABELS[stageKey] ?? { label: stageKey, desc: "" };

						return (
							<div key={stageKey} className="flex items-start gap-3">
								<div className="mt-0.5 shrink-0">
									{done ? (
										<CheckCircle2 className="h-4 w-4 text-emerald-400" />
									) : isCurrentActive ? (
										<Loader2 className="h-4 w-4 text-orange-400 animate-spin" />
									) : (
										<Circle className="h-4 w-4 text-muted-foreground/30" />
									)}
								</div>
								<div className="flex-1">
									<div className="flex items-center justify-between">
										<span
											className={`text-xs font-medium ${
												done
													? "text-foreground"
													: isCurrentActive
														? "text-orange-400 font-semibold"
														: "text-muted-foreground"
											}`}
										>
											{stageInfo.label}
										</span>
										{done && <span className="text-[10px] text-emerald-400 font-mono">completed</span>}
										{isCurrentActive && (
											<span className="text-[10px] text-orange-400 font-mono animate-pulse">active</span>
										)}
									</div>
									<p className="text-[11px] text-muted-foreground/80 mt-0.5">{stageInfo.desc}</p>
								</div>
							</div>
						);
					})}
				</div>

				{progress.length > 0 && (
					<div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-inner space-y-1.5">
						<div className="flex items-center justify-between border-b border-zinc-850 pb-1.5 text-[10px] text-zinc-400 font-mono">
							<span className="flex items-center gap-1.5">
								<Terminal className="h-3 w-3 text-orange-400" /> Agent Thought Trace
							</span>
							{running && <span className="text-orange-400 animate-pulse">streaming…</span>}
						</div>
						<pre className="max-h-28 overflow-y-auto font-mono text-[11px] leading-relaxed text-zinc-300">
							{progress.slice(-10).join("\n")}
						</pre>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
