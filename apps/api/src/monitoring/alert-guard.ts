export type ScalingSuggestion =
	| { kind: "enable_autoscaling" }
	| { kind: "increase_max_replicas"; current: number; maxReplicas: number };

export type ScalingContext = {
	policy: { enabled: boolean; maxReplicas: number } | null;
	cpuLimit: number | null;
	currentReplicas: number | null;
};

export type ScalingGuard =
	| { suppress: true; suggestion: null }
	| { suppress: false; suggestion: ScalingSuggestion | null };

export const scalingGuard = (alertType: string, ctx: ScalingContext): ScalingGuard => {
	if (alertType !== "cpu" && alertType !== "memory") {
		return { suppress: false, suggestion: null };
	}
	if (!ctx.policy || !ctx.policy.enabled || !ctx.cpuLimit || ctx.cpuLimit <= 0) {
		return { suppress: false, suggestion: { kind: "enable_autoscaling" } };
	}
	const current = ctx.currentReplicas ?? 1;
	if (current >= ctx.policy.maxReplicas) {
		return {
			suppress: false,
			suggestion: { kind: "increase_max_replicas", current, maxReplicas: ctx.policy.maxReplicas },
		};
	}
	return { suppress: true, suggestion: null };
};
