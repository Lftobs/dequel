import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "../../hooks/useProjects";
import * as api from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface ScalingTabProps {
	projectId: string;
}

export function ScalingTab({ projectId }: ScalingTabProps) {
	const { data: project, refetch: refetchProject } =
		useProject(projectId);
	const { data: policy, refetch } = useQuery({
		queryKey: ["scaling", projectId],
		queryFn: () =>
			api
				.getScalingPolicy(projectId)
				.catch(() => null),
	});
	const [cpuLimit, setCpuLimit] = useState(
		project?.cpuLimit?.toString() ?? "",
	);
	const [memoryLimitMb, setMemoryLimitMb] = useState(
		project?.memoryLimitMb?.toString() ?? "",
	);
	const [minR, setMinR] = useState(
		policy?.minReplicas ?? 1,
	);
	const [maxR, setMaxR] = useState(
		policy?.maxReplicas ?? 5,
	);
	const [cpuT, setCpuT] = useState(
		policy?.cpuThresholdPercent ?? 70,
	);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Resource Limits
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-4">
						Set CPU and memory limits applied to all deployments for this project.
					</p>
					<div className="grid gap-4 sm:grid-cols-2 mb-4">
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								CPU Limit (cores)
							</label>
							<Input
								type="number"
								min={0}
								step="0.1"
								placeholder="e.g. 1"
								value={cpuLimit}
								onChange={(e) =>
									setCpuLimit(e.target.value)
								}
							/>
						</div>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								Memory Limit (MB)
							</label>
							<Input
								type="number"
								min={0}
								step="64"
								placeholder="e.g. 512"
								value={memoryLimitMb}
								onChange={(e) =>
									setMemoryLimitMb(e.target.value)
								}
							/>
						</div>
					</div>
					<Button
						onClick={async () => {
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
						}}
					>
						Save Limits
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Auto-scaling Policy
					</CardTitle>
				</CardHeader>
				<CardContent>
					{!policy && (
						<p className="text-sm text-muted-foreground mb-4">
							No scaling policy
							configured. Set one up
							below.
						</p>
					)}
					<div className="grid gap-4 sm:grid-cols-3 mb-4">
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								Min Replicas
							</label>
							<Input
								type="number"
								min={1}
								value={minR}
								onChange={(e) =>
									setMinR(
										Number(
											e
												.target
												.value,
										),
									)
								}
							/>
						</div>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								Max Replicas
							</label>
							<Input
								type="number"
								min={1}
								value={maxR}
								onChange={(e) =>
									setMaxR(
										Number(
											e
												.target
												.value,
										),
									)
								}
							/>
						</div>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								CPU Threshold %
							</label>
							<Input
								type="number"
								min={10}
								max={100}
								value={cpuT}
								onChange={(e) =>
									setCpuT(
										Number(
											e
												.target
												.value,
										),
									)
								}
							/>
						</div>
					</div>
					<Button
						onClick={async () => {
							await api.upsertScalingPolicy(
								projectId,
								{
									minReplicas:
										minR,
									maxReplicas:
										maxR,
									cpuThresholdPercent:
										cpuT,
								} as any,
							);
							refetch();
						}}
					>
						Save Policy
					</Button>
					{policy && (
						<div className="mt-4 text-sm text-muted-foreground space-y-1">
							<p>
								Status:{" "}
								<span
									className={
										policy.enabled
											? "text-emerald-500 font-medium"
											: ""
									}
								>
									{policy.enabled
										? "Enabled"
										: "Disabled"}
								</span>
							</p>
							<p>
								Cooldown:{" "}
								{
									policy.cooldownSeconds
								}
								s between scaling
								actions
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
