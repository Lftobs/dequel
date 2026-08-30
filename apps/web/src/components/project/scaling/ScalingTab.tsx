import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "../../../hooks/useProjects";
import * as api from "../../../api/client";
import { ResourceLimitsCard } from "./ResourceLimitsCard";
import { AutoscalingPolicyCard } from "./AutoscalingPolicyCard";

interface ScalingTabProps {
	projectId: string;
}

export function ScalingTab({ projectId }: ScalingTabProps) {
	const {
		data: project,
		refetch: refetchProject,
	} = useProject(projectId);
	const { data: policy, refetch } = useQuery({
		queryKey: ["scaling", projectId],
		queryFn: () => api.getScalingPolicy(projectId).catch(() => null),
	});

	const [cpuLimit, setCpuLimit] = useState("");
	const [memoryLimitMb, setMemoryLimitMb] = useState("");
	const [minR, setMinR] = useState(1);
	const [maxR, setMaxR] = useState(5);
	const [cpuT, setCpuT] = useState(70);

	const [isConfiguring, setIsConfiguring] = useState(false);
	const [isSavingLimits, setIsSavingLimits] = useState(false);
	const [isSavingPolicy, setIsSavingPolicy] = useState(false);
	const [isDisableScalingOpen, setIsDisableScalingOpen] = useState(false);

	useEffect(() => {
		if (project) {
			setCpuLimit(project.cpuLimit?.toString() ?? "");
			setMemoryLimitMb(project.memoryLimitMb?.toString() ?? "");
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
				cpuLimit: cpuLimit.trim() ? Number(cpuLimit) : null,
				memoryLimitMb: memoryLimitMb.trim() ? Number(memoryLimitMb) : null,
			});
			refetchProject();
		} finally {
			setIsSavingLimits(false);
		}
	};

	const savePolicy = async () => {
		setIsSavingPolicy(true);
		try {
			await api.upsertScalingPolicy(projectId, {
				minReplicas: minR,
				maxReplicas: maxR,
				cpuThresholdPercent: cpuT,
			} as any);
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

	return (
		<div className="space-y-6">
			<ResourceLimitsCard
				cpuLimit={cpuLimit}
				setCpuLimit={setCpuLimit}
				memoryLimitMb={memoryLimitMb}
				setMemoryLimitMb={setMemoryLimitMb}
				isSavingLimits={isSavingLimits}
				onSaveLimits={saveLimits}
				hasLimits={Boolean(project?.cpuLimit || project?.memoryLimitMb)}
			/>

			<AutoscalingPolicyCard
				policy={policy}
				isConfiguring={isConfiguring}
				setIsConfiguring={setIsConfiguring}
				minR={minR}
				setMinR={setMinR}
				maxR={maxR}
				setMaxR={setMaxR}
				cpuT={cpuT}
				setCpuT={setCpuT}
				isSavingPolicy={isSavingPolicy}
				onSavePolicy={savePolicy}
				onDeletePolicy={deletePolicy}
				isDisableOpen={isDisableScalingOpen}
				setIsDisableOpen={setIsDisableScalingOpen}
			/>
		</div>
	);
}
