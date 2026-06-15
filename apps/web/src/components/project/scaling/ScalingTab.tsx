import React, {
	useState,
	useEffect,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "../../../hooks/useProjects";
import * as api from "../../../api/client";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../../ui/dialog";
import {
	Cpu,
	Database,
	TrendingUp,
	Sliders,
	Trash2,
	Check,
	Sparkles,
} from "lucide-react";

interface ScalingTabProps {
	projectId: string;
}

const PRESETS = [
	{
		name: "Starter",
		cpu: "0.25",
		memory: "256",
		desc: "Shared CPU / 256MB",
	},
	{
		name: "Standard",
		cpu: "1",
		memory: "512",
		desc: "1 Core / 512MB",
	},
	{
		name: "Professional",
		cpu: "2",
		memory: "1024",
		desc: "2 Cores / 1GB",
	},
];

export function ScalingTab({
	projectId,
}: ScalingTabProps) {
	const {
		data: project,
		refetch: refetchProject,
	} = useProject(projectId);
	const { data: policy, refetch } = useQuery({
		queryKey: ["scaling", projectId],
		queryFn: () =>
			api
				.getScalingPolicy(projectId)
				.catch(() => null),
	});

	const [cpuLimit, setCpuLimit] = useState("");
	const [memoryLimitMb, setMemoryLimitMb] =
		useState("");
	const [minR, setMinR] = useState(1);
	const [maxR, setMaxR] = useState(5);
	const [cpuT, setCpuT] = useState(70);

	const [isConfiguring, setIsConfiguring] =
		useState(false);
	const [isSavingLimits, setIsSavingLimits] =
		useState(false);
	const [isSavingPolicy, setIsSavingPolicy] =
		useState(false);
	const [
		isDisableScalingOpen,
		setIsDisableScalingOpen,
	] = useState(false);

	useEffect(() => {
		if (project) {
			setCpuLimit(
				project.cpuLimit?.toString() ??
					"",
			);
			setMemoryLimitMb(
				project.memoryLimitMb?.toString() ??
					"",
			);
		}
	}, [project]);

	useEffect(() => {
		if (policy) {
			setMinR(policy.minReplicas);
			setMaxR(policy.maxReplicas);
			setCpuT(policy.cpuThresholdPercent);
		} else {
			setIsConfiguring(false);
		}
	}, [policy]);

	const saveLimits = async () => {
		setIsSavingLimits(true);
		try {
			await api.updateProject(projectId, {
				cpuLimit: cpuLimit.trim()
					? Number(cpuLimit)
					: null,
				memoryLimitMb:
					memoryLimitMb.trim()
						? Number(memoryLimitMb)
						: null,
			});
			refetchProject();
		} finally {
			setIsSavingLimits(false);
		}
	};

	const savePolicy = async () => {
		setIsSavingPolicy(true);
		try {
			await api.upsertScalingPolicy(
				projectId,
				{
					minReplicas: minR,
					maxReplicas: maxR,
					cpuThresholdPercent: cpuT,
				} as any,
			);
			refetch();
			setIsConfiguring(false);
		} finally {
			setIsSavingPolicy(false);
		}
	};

	const deletePolicy = async () => {
		await api.deleteScalingPolicy(projectId);
		refetch();
		setIsConfiguring(false);
		setIsDisableScalingOpen(false);
	};

	const matchedPreset = PRESETS.find(
		(p) =>
			p.cpu === cpuLimit &&
			p.memory === memoryLimitMb,
	);

	return (
		<div className="space-y-6">
			{/* Resource Limits Card */}
			<Card className="bg-card/40 border-border backdrop-blur-sm">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<div className="space-y-1">
						<CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
							<Cpu className="h-5 w-5 text-primary" />{" "}
							Resource Allocation
						</CardTitle>
						<p className="text-xs text-muted-foreground">
							Set custom limits or
							select a package for
							containers.
						</p>
					</div>
					{project?.cpuLimit ||
					project?.memoryLimitMb ? (
						<Badge
							variant="outline"
							className="border-primary/20 text-primary bg-primary/5 uppercase text-[10px]"
						>
							{matchedPreset
								? matchedPreset.name
								: "Custom Limit"}
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="border-muted text-muted-foreground uppercase text-[10px]"
						>
							Unlimited
						</Badge>
					)}
				</CardHeader>
				<CardContent className="space-y-5">
					{/* Preset selection grid */}
					<div className="grid grid-cols-3 gap-2">
						{PRESETS.map((p) => {
							const isSelected =
								cpuLimit ===
									p.cpu &&
								memoryLimitMb ===
									p.memory;
							return (
								<button
									key={p.name}
									type="button"
									onClick={() => {
										setCpuLimit(
											p.cpu,
										);
										setMemoryLimitMb(
											p.memory,
										);
									}}
									className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
										isSelected
											? "border-primary bg-primary/5 shadow-md shadow-primary/5"
											: "border-border bg-[#0d0d11] hover:border-border/80 hover:bg-[#121217]"
									}`}
								>
									<span
										className={`text-xs font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}
									>
										{p.name}
									</span>
									<span className="text-[10px] text-muted-foreground mt-0.5">
										{p.desc}
									</span>
								</button>
							);
						})}
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								CPU Limit (cores)
							</label>
							<div className="relative flex items-center">
								<Input
									type="number"
									min={0}
									step="0.1"
									placeholder="No limit"
									value={
										cpuLimit
									}
									onChange={(
										e,
									) =>
										setCpuLimit(
											e
												.target
												.value,
										)
									}
									className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary pr-14 text-sm font-semibold rounded-lg"
								/>
								<span className="absolute right-3 text-xs font-semibold text-muted-foreground">
									cores
								</span>
							</div>
						</div>
						<div className="grid gap-2">
							<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Memory Limit (MB)
							</label>
							<div className="relative flex items-center">
								<Input
									type="number"
									min={0}
									step="64"
									placeholder="No limit"
									value={
										memoryLimitMb
									}
									onChange={(
										e,
									) =>
										setMemoryLimitMb(
											e
												.target
												.value,
										)
									}
									className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary pr-12 text-sm font-semibold rounded-lg"
								/>
								<span className="absolute right-3 text-xs font-semibold text-muted-foreground">
									MB
								</span>
							</div>
						</div>
					</div>

					<div className="flex items-center justify-between pt-2">
						<button
							type="button"
							onClick={() => {
								setCpuLimit("");
								setMemoryLimitMb(
									"",
								);
							}}
							className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
						>
							Clear Resource Limits
						</button>
						<Button
							onClick={saveLimits}
							disabled={
								isSavingLimits
							}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 px-5 rounded-lg shadow-md transition-all"
						>
							{isSavingLimits
								? "Saving Limits..."
								: "Save Limits"}
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Auto-scaling Policy Card */}
			<Card className="bg-card/40 border-border backdrop-blur-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
						<TrendingUp className="h-5 w-5 text-primary" />{" "}
						Auto-scaling Policy
					</CardTitle>
				</CardHeader>
				<CardContent>
					{!policy && !isConfiguring ? (
						<div className="flex flex-col items-center justify-center py-6 text-center">
							<div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 border border-primary/15">
								<Sliders className="h-5 w-5" />
							</div>
							<h4 className="text-sm font-semibold text-foreground mb-1">
								Auto-scaling is
								not configured
							</h4>
							<p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">
								Automatically
								adjust replica
								counts between
								min/max limits
								based on average
								CPU usage. Perfect
								for load spikes.
							</p>
							<Button
								onClick={() =>
									setIsConfiguring(
										true,
									)
								}
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-lg transition-all shadow-md"
							>
								Configure
								Auto-scaling
							</Button>
						</div>
					) : isConfiguring ||
					  !policy ? (
						<div className="space-y-5">
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="grid gap-2">
									<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Min
										Replicas
									</label>
									<Input
										type="number"
										min={1}
										value={
											minR
										}
										onChange={(
											e,
										) =>
											setMinR(
												Number(
													e
														.target
														.value,
												),
											)
										}
										className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg"
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Max
										Replicas
									</label>
									<Input
										type="number"
										min={1}
										value={
											maxR
										}
										onChange={(
											e,
										) =>
											setMaxR(
												Number(
													e
														.target
														.value,
												),
											)
										}
										className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg"
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										CPU Target
										%
									</label>
									<div className="relative flex items-center">
										<Input
											type="number"
											min={
												10
											}
											max={
												100
											}
											value={
												cpuT
											}
											onChange={(
												e,
											) =>
												setCpuT(
													Number(
														e
															.target
															.value,
													),
												)
											}
											className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary pr-8 text-sm font-semibold rounded-lg"
										/>
										<span className="absolute right-3 text-xs font-semibold text-muted-foreground">
											%
										</span>
									</div>
								</div>
							</div>

							<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
								{policy && (
									<Button
										type="button"
										variant="ghost"
										onClick={() =>
											setIsConfiguring(
												false,
											)
										}
										className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
									>
										Cancel
									</Button>
								)}
								<Button
									onClick={
										savePolicy
									}
									disabled={
										isSavingPolicy
									}
									className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 px-5 rounded-lg shadow-md transition-all"
								>
									{isSavingPolicy
										? "Saving Policy..."
										: "Save Policy"}
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
										Scale
										Range
									</div>
									<div className="text-sm font-bold text-foreground mt-1">
										{
											policy.minReplicas
										}{" "}
										–{" "}
										{
											policy.maxReplicas
										}{" "}
										replicas
									</div>
								</div>
								<div>
									<div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
										CPU
										Threshold
									</div>
									<div className="text-sm font-bold text-foreground mt-1">
										{
											policy.cpuThresholdPercent
										}
										%
										utilization
									</div>
								</div>
								<div>
									<div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
										Cooldown
									</div>
									<div className="text-sm font-bold text-foreground mt-1">
										{
											policy.cooldownSeconds
										}
										s between
										actions
									</div>
								</div>
							</div>

							{/* Visual scale range gauge */}
							<div className="space-y-2 px-1">
								<div className="flex justify-between text-[11px] text-muted-foreground">
									<span>
										Min Scale
										(
										{
											policy.minReplicas
										}{" "}
										Container)
									</span>
									<span className="text-primary font-medium">
										Trigger
										&gt;{" "}
										{
											policy.cpuThresholdPercent
										}
										% CPU
									</span>
									<span>
										Max Scale
										(
										{
											policy.maxReplicas
										}{" "}
										Containers)
									</span>
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

							<div className="flex items-center justify-between pt-2 border-t border-border/40">
								<Button
									variant="outline"
									onClick={() =>
										setIsDisableScalingOpen(
											true,
										)
									}
									className="border-destructive/30 hover:border-destructive hover:bg-destructive/10 text-destructive text-xs font-semibold h-9 px-4 rounded-lg flex items-center gap-1.5 transition-all"
								>
									<Trash2 className="h-4 w-4" />{" "}
									Disable
									Auto-scaling
								</Button>
								<Button
									onClick={() =>
										setIsConfiguring(
											true,
										)
									}
									className="bg-secondary hover:bg-secondary/80 text-foreground font-semibold h-9 px-5 rounded-lg border border-border transition-all"
								>
									Edit Scaling
									Policy
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={isDisableScalingOpen}
				onOpenChange={
					setIsDisableScalingOpen
				}
			>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Disable Auto-scaling
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Are you sure you want
							to disable
							auto-scaling for this
							project? This will
							stop adjusting
							container replicas
							automatically based on
							CPU usage.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() =>
								setIsDisableScalingOpen(
									false,
								)
							}
							className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							onClick={deletePolicy}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs h-9 px-4 rounded-lg transition-all"
						>
							Disable Scaling
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
