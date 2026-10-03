import { CheckCircle2, ExternalLink, GitPullRequest, Loader2 } from "lucide-react";
import type { DiagCause } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { DiffViewer } from "./DiffViewer";

interface DiagnoseVerdictProps {
	cause: DiagCause;
	summary: string;
	fixSteps: string[] | undefined;
	userFix?: { title: string; body: string; suggestedDiff: string | null };
	dequelReport?: { problem: string; cause: string; proposedFix: string };
	dequelVersion?: string;
	dequelStale?: boolean;
	slackPosted: boolean;
	isGit: boolean;
	prUrl: string | null;
	approving: "pr" | null;
	onApprovePr: () => void;
}

export function DiagnoseVerdict({
	cause,
	summary,
	fixSteps = [],
	userFix,
	dequelReport,
	dequelVersion,
	dequelStale,
	slackPosted,
	isGit,
	prUrl,
	approving,
	onApprovePr,
}: DiagnoseVerdictProps) {
	return (
		<Card className="border-border/60 bg-card/60 overflow-hidden shadow-md">
			<CardHeader className="py-3 px-4 border-b border-border/30">
				<div className="flex items-center justify-between">
					<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Diagnosis Verdict
					</CardTitle>
					<Badge
						variant={cause === "user-source" ? "warning" : cause === "dequel-source" ? "destructive" : "secondary"}
						className={`text-xs font-medium ${
							cause === "user-source"
								? "bg-amber-500/15 text-amber-300 border-amber-500/30"
								: cause === "dequel-source"
									? "bg-red-500/15 text-red-300 border-red-500/30"
									: "bg-muted text-muted-foreground"
						}`}
					>
						{cause === "user-source"
							? "Application Code Issue"
							: cause === "dequel-source"
								? "Dequel Platform Issue"
								: "Inconclusive"}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-4 space-y-4 text-xs">
				{summary && (
					<div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-foreground leading-relaxed">
						{summary}
					</div>
				)}

				{fixSteps.length > 0 && (
					<div className="space-y-2">
						<p className="font-semibold text-foreground">Recommended Fix Steps:</p>
						<ol className="space-y-1.5 pl-1">
							{fixSteps.map((step, i) => (
								<li key={i} className="flex items-start gap-2 text-muted-foreground">
									<span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-400 font-mono text-[10px] mt-0.5">
										{i + 1}
									</span>
									<span className="flex-1 text-foreground/90">{step}</span>
								</li>
							))}
						</ol>
					</div>
				)}

				{userFix && (
					<div className="space-y-3 pt-2 border-t border-border/30">
						<div>
							<p className="font-semibold text-foreground text-sm">{userFix.title}</p>
							{userFix.body && <p className="text-muted-foreground mt-0.5">{userFix.body}</p>}
						</div>

						{userFix.suggestedDiff && <DiffViewer diff={userFix.suggestedDiff} title="Proposed Code Diff" />}

						{isGit ? (
							prUrl ? (
								<div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
									<span className="text-emerald-300 font-medium flex items-center gap-1.5">
										<CheckCircle2 className="h-4 w-4" /> Pull request created
									</span>
									<a
										href={prUrl}
										target="_blank"
										rel="noreferrer"
										className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-mono text-xs underline"
									>
										Open PR <ExternalLink className="h-3 w-3" />
									</a>
								</div>
							) : (
								<Button
									onClick={onApprovePr}
									disabled={approving === "pr"}
									className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs w-full sm:w-auto"
								>
									{approving === "pr" ? (
										<>
											<Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating Pull Request…
										</>
									) : (
										<>
											<GitPullRequest className="h-3.5 w-3.5" /> Create Fix Pull Request
										</>
									)}
								</Button>
							)
						) : (
							<p className="text-muted-foreground text-[11px]">Automated Fix PRs are available for Git repositories.</p>
						)}
					</div>
				)}

				{dequelReport && (
					<div className="space-y-2.5 pt-2 border-t border-border/30">
						<div className="space-y-1">
							<span className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">Problem</span>
							<p className="text-foreground">{dequelReport.problem}</p>
						</div>

						{dequelVersion && (
							<div className="space-y-0.5">
								<span className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
									Dequel Version
								</span>
								<p className="font-mono text-xs">
									{dequelVersion}
									{dequelStale && <span className="text-amber-400"> (potentially stale build)</span>}
								</p>
							</div>
						)}

						<div className="space-y-1">
							<span className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
								Root Cause
							</span>
							<p className="text-foreground">{dequelReport.cause}</p>
						</div>

						<div className="space-y-1">
							<span className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
								Proposed Platform Fix
							</span>
							<p className="text-foreground">{dequelReport.proposedFix}</p>
						</div>

						{slackPosted ? (
							<p className="text-emerald-400 flex items-center gap-1.5 pt-1">
								<CheckCircle2 className="h-3.5 w-3.5" /> Incident automatically submitted to the Dequel team Slack
								channel.
							</p>
						) : (
							<p className="text-muted-foreground text-[11px] pt-1">
								Slack notification not posted (channel not configured or webhook unavailable).
							</p>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
