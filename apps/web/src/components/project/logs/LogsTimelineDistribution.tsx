interface Bin {
	start: number;
	end: number;
	count: number;
}

interface LogsTimelineDistributionProps {
	logSource: "runtime" | "request";
	bins: Bin[];
	maxCount: number;
}

export function LogsTimelineDistribution({
	logSource,
	bins,
	maxCount,
}: LogsTimelineDistributionProps) {
	return (
		<div className="rounded-xl border border-[#1a1a1f] bg-[#0c0c0e] p-4 space-y-1">
			<div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider select-none">
				{logSource === "request"
					? "Request Count Distribution (Last 30 Minutes)"
					: "Log Count Distribution (Last 30 Minutes)"}
			</div>
			<div className="h-12 flex items-end gap-1.5 pt-4 select-none">
				{bins.map((bin, idx) => (
					<div
						key={idx}
						className="flex-1 rounded-sm bg-zinc-800 hover:bg-amber-500/50 transition-colors relative group"
						style={{
							height: `${(bin.count / maxCount) * 100}%`,
							minHeight: "2px",
						}}
					>
						<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#111113] border border-[#27272a] text-[10px] text-zinc-200 px-2 py-0.5 rounded shadow-xl whitespace-nowrap z-30 font-mono">
							{bin.count} logs
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
