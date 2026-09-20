import { Terminal } from "lucide-react";

interface ServerPreparationOutputProps {
	preparingId: string | null;
	prepareLogs: { stage: string; message: string }[];
	prepareDone: boolean;
	prepareError: string | null;
}

export function ServerPreparationOutput({
	preparingId,
	prepareLogs,
	prepareDone,
	prepareError,
}: ServerPreparationOutputProps) {
	return (
		<div className="space-y-4">
			{preparingId && (
				<div className="rounded-2xl border border-orange-500/30 bg-black/80 p-4 space-y-3 backdrop-blur-md shadow-2xl">
					<div className="flex items-center justify-between border-b border-zinc-800 pb-3">
						<div className="flex items-center gap-2">
							<Terminal className="h-4 w-4 text-orange-400" />
							<span className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider">
								Server Preparation Terminal Output ({prepareLogs.length} events)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-2 w-2 animate-ping rounded-full bg-orange-400" />
							<span className="text-[10px] text-orange-400 font-mono">Live Stream</span>
						</div>
					</div>
					<div className="max-h-56 overflow-y-auto space-y-1.5 font-mono text-xs pr-2">
						{prepareLogs.map((entry, i) => (
							<div key={i} className="flex items-start gap-2">
								<span className="text-orange-500 font-semibold shrink-0">[{entry.stage}]</span>
								<span className={entry.stage === "token" ? "text-emerald-400 break-all" : "text-zinc-300"}>
									{entry.message}
								</span>
							</div>
						))}
						{prepareLogs.length === 0 && (
							<div className="text-zinc-500 italic">
								Initializing SSH connection and bootstrapping container engine...
							</div>
						)}
					</div>
				</div>
			)}

			{prepareDone && (
				<div
					className={`rounded-2xl border p-4 text-xs font-medium ${
						prepareError
							? "border-red-500/40 bg-red-950/20 text-red-400"
							: "border-emerald-500/40 bg-emerald-950/20 text-emerald-400"
					}`}
				>
					{prepareError
						? `Server preparation failed: ${prepareError}`
						: "Node prepared successfully. Container daemon is active and ready for deployments."}
				</div>
			)}
		</div>
	);
}
