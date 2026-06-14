interface NodeStatusCardProps {
	metrics: {
		activeDeployments?: number;
		requestsTotal?: number;
	} | null;
}

export function NodeStatusCard({ metrics }: NodeStatusCardProps) {
	return (
		<div className="rounded-xl bg-[#101012] border border-[#1c1c21] p-3.5 space-y-3 text-[11px]">
			<div className="flex items-center justify-between text-zinc-400 border-b border-[#1c1c21]/85 pb-2">
				<span className="font-bold uppercase tracking-wider text-[10px] text-zinc-400">
					Node Status
				</span>
				<span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
					<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
					Live
				</span>
			</div>

			<div className="space-y-2.5">
				<div className="flex items-center justify-between">
					<span className="text-zinc-500 flex items-center gap-1.5">
						<span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
						Active Services
					</span>
					<span className="font-mono text-zinc-300 font-semibold">
						{metrics?.activeDeployments ?? 0}
					</span>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-zinc-500 flex items-center gap-1.5">
						<span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
						API Traffic
					</span>
					<span className="font-mono text-zinc-300 font-semibold">
						{metrics?.requestsTotal ?? 0}
					</span>
				</div>
			</div>
		</div>
	);
}
