import { X } from "lucide-react";
import { cn } from "../../../lib/utils";

interface LogDetailSheetProps {
	selectedLog: any;
	onClose: () => void;
	logSource: "runtime" | "request";
}

export function LogDetailSheet({
	selectedLog,
	onClose,
	logSource,
}: LogDetailSheetProps) {
	if (!selectedLog) return null;

	return (
		<>
			<div
				className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
				onClick={onClose}
			/>
			<div className="fixed inset-y-0 right-0 z-50 w-full max-w-md lg:static lg:w-[360px] lg:z-auto border-l lg:border border-[#27272a] bg-[#111113] lg:rounded-xl p-5 space-y-4 animate-in slide-in-from-right-full lg:slide-in-from-right-3 duration-250 shrink-0 shadow-2xl overflow-y-auto max-h-screen lg:max-h-[500px]">
				<div className="flex items-center justify-between">
					<h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
						Log Event Details
					</h4>
					<button
						onClick={onClose}
						className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div>
					<span
						className={cn(
							"px-2 py-0.5 rounded text-[10px] font-bold uppercase",
							selectedLog.level === "error"
								? "bg-red-500/10 text-red-400 border border-red-500/20"
								: selectedLog.level === "warning"
									? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
									: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
						)}
					>
						{selectedLog.level}
					</span>
				</div>

				<div className="space-y-3 font-mono text-[11px]">
					<div className="space-y-1">
						<div className="text-zinc-500 text-[10px] uppercase font-sans">
							Timestamp
						</div>
						<div className="text-zinc-300">
							{new Date(
								selectedLog.timestamp || selectedLog.createdAt,
							).toLocaleString()}
						</div>
					</div>

					{logSource === "request" && selectedLog.status && (
						<div className="space-y-1">
							<div className="text-zinc-500 text-[10px] uppercase font-sans">
								Status
							</div>
							<div className="text-zinc-300">
								{selectedLog.status}
							</div>
						</div>
					)}

					{logSource === "request" && selectedLog.request && (
						<div className="space-y-1">
							<div className="text-zinc-500 text-[10px] uppercase font-sans">
								Request
							</div>
							<div className="text-zinc-300">
								{selectedLog.request}
							</div>
						</div>
					)}

					{logSource === "request" && selectedLog.duration && (
						<div className="space-y-1">
							<div className="text-zinc-500 text-[10px] uppercase font-sans">
								Duration
							</div>
							<div className="text-zinc-300">
								{selectedLog.duration}
							</div>
						</div>
					)}

					{logSource === "request" && selectedLog.size && (
						<div className="space-y-1">
							<div className="text-zinc-500 text-[10px] uppercase font-sans">
								Size
							</div>
							<div className="text-zinc-300">
								{selectedLog.size}
							</div>
						</div>
					)}

					<div className="space-y-1">
						<div className="text-zinc-500 text-[10px] uppercase font-sans">
							Message
						</div>
						<div className="text-zinc-300 break-all">
							{selectedLog.parsedMessage}
						</div>
					</div>

					<div className="space-y-1">
						<div className="text-zinc-500 text-[10px] uppercase font-sans">
							Raw JSON payload
						</div>
						<pre className="p-3 rounded bg-[#070708] border border-[#1e1e22] text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[220px]">
							{selectedLog.raw}
						</pre>
					</div>
				</div>
			</div>
		</>
	);
}
