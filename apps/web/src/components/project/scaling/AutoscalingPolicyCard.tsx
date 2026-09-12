import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { TrendingUp, Sliders, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../ui/dialog";

interface ScalingPolicy {
	minReplicas: number;
	maxReplicas: number;
	cpuThresholdPercent: number;
	cooldownSeconds?: number;
}

interface AutoscalingPolicyCardProps {
	policy: ScalingPolicy | null | undefined;
	isConfiguring: boolean;
	setIsConfiguring: (v: boolean) => void;
	minR: number;
	setMinR: (v: number) => void;
	maxR: number;
	setMaxR: (v: number) => void;
	cpuT: number;
	setCpuT: (v: number) => void;
	isSavingPolicy: boolean;
	onSavePolicy: () => Promise<void>;
	onDeletePolicy: () => Promise<void>;
	isDisableOpen: boolean;
	setIsDisableOpen: (v: boolean) => void;
}

export function AutoscalingPolicyCard({
	policy,
	isConfiguring,
	setIsConfiguring,
	minR,
	setMinR,
	maxR,
	setMaxR,
	cpuT,
	setCpuT,
	isSavingPolicy,
	onSavePolicy,
	onDeletePolicy,
	isDisableOpen,
	setIsDisableOpen,
}: AutoscalingPolicyCardProps) {
	return (
		<>
			<Card className="bg-card/40 border-border backdrop-blur-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
						<TrendingUp className="h-5 w-5 text-primary" /> Auto-scaling Policy
					</CardTitle>
				</CardHeader>
				<CardContent>
					{!policy && !isConfiguring ? (
						<div className="flex flex-col items-center justify-center py-6 text-center">
							<div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 border border-primary/15">
								<Sliders className="h-5 w-5" />
							</div>
							<h4 className="text-sm font-semibold text-foreground mb-1">
								Auto-scaling is not configured
							</h4>
							<p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">
								Automatically adjust replica counts between min/max limits based on average CPU usage. Perfect for load spikes.
							</p>
							<Button
								onClick={() => setIsConfiguring(true)}
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-lg transition-all shadow-md w-full sm:w-auto"
							>
								Configure Auto-scaling
							</Button>
						</div>
					) : isConfiguring || !policy ? (
						<div className="space-y-5">
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="grid gap-2">
									<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Min Replicas
									</label>
									<Input
										type="number"
										min={1}
										value={minR}
										onChange={(e) => setMinR(Number(e.target.value))}
										className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg"
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Max Replicas
									</label>
									<Input
										type="number"
										min={1}
										value={maxR}
										onChange={(e) => setMaxR(Number(e.target.value))}
										className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg"
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										CPU Target %
									</label>
									<div className="relative flex items-center">
										<Input
											type="number"
											min={10}
											max={100}
											value={cpuT}
											onChange={(e) => setCpuT(Number(e.target.value))}
											className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary pr-8 text-sm font-semibold rounded-lg"
										/>
										<span className="absolute right-3 text-xs font-semibold text-muted-foreground">
											%
										</span>
									</div>
								</div>
							</div>

							<div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-border/40">
								{policy && (
									<Button
										type="button"
										variant="ghost"
										onClick={() => setIsConfiguring(false)}
										className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21] w-full sm:w-auto"
									>
										Cancel
									</Button>
								)}
								<Button
									onClick={onSavePolicy}
									disabled={isSavingPolicy}
									className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 px-5 rounded-lg shadow-md transition-all w-full sm:w-auto"
								>
									{isSavingPolicy ? "Saving Policy..." : "Save Policy"}
								</Button>
							</div>
						</div>
					) : (
						<div className="space-y-6">
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-border bg-[#0d0d11]">
								<div>
									<div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
										Status
									</div>
									<div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
										<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
										Active
									</div>
								</div>
								<div>
									<div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
										Scale Range
									</div>
									<div className="text-sm font-bold text-foreground mt-1">
										{policy.minReplicas} – {policy.maxReplicas} replicas
									</div>
								</div>
								<div>
									<div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
										CPU Threshold
									</div>
									<div className="text-sm font-bold text-foreground mt-1">
										{policy.cpuThresholdPercent}% utilization
									</div>
								</div>
								<div>
									<div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
										Cooldown
									</div>
									<div className="text-sm font-bold text-foreground mt-1">
										{policy.cooldownSeconds || 60}s between actions
									</div>
								</div>
							</div>

							<div className="space-y-2 px-1">
								<div className="flex justify-between text-[11px] text-muted-foreground">
									<span>Min Scale ({policy.minReplicas} Container)</span>
									<span className="text-primary font-medium">Trigger &gt; {policy.cpuThresholdPercent}% CPU</span>
									<span>Max Scale ({policy.maxReplicas} Containers)</span>
								</div>
								<div className="relative h-2 rounded-full bg-[#15151c] overflow-hidden border border-border">
									<div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-primary/10 via-primary/30 to-primary/60" />
									<div
										className="absolute top-0 bottom-0 bg-primary/80 transition-all duration-500"
										style={{
											left: `${(policy.minReplicas / policy.maxReplicas) * 100}%`,
											right: "0%",
										}}
									/>
								</div>
							</div>

							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
								<Button
									variant="outline"
									onClick={() => setIsDisableOpen(true)}
									className="border-destructive/30 hover:border-destructive hover:bg-destructive/10 text-destructive text-xs font-semibold h-9 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto"
								>
									<Trash2 className="h-4 w-4" /> Disable Auto-scaling
								</Button>
								<Button
									onClick={() => setIsConfiguring(true)}
									className="bg-secondary hover:bg-secondary/80 text-foreground font-semibold h-9 px-5 rounded-lg border border-border transition-all w-full sm:w-auto"
								>
									Edit Scaling Policy
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<Dialog open={isDisableOpen} onOpenChange={setIsDisableOpen}>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Disable Auto-scaling
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Are you sure you want to disable auto-scaling for this project? This will stop adjusting container replicas automatically based on CPU usage.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() => setIsDisableOpen(false)}
							className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							onClick={onDeletePolicy}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs h-9 px-4 rounded-lg transition-all"
						>
							Disable Scaling
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
