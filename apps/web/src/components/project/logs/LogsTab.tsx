import React, { useState } from "react";
import { useDeployments } from "../../../hooks/useDeployments";
import {
	useRuntimeLogs,
	useRequestLogs,
} from "../../../hooks/useDeploymentLogs";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
	Search,
	RefreshCw,
	X,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { LogsTimelineDistribution } from "./LogsTimelineDistribution";
import { LogsEventsTable } from "./LogsEventsTable";
import { LogDetailSheet } from "./LogDetailSheet";
import { parseLogEntry } from "./parseLogEntry";

interface LogsTabProps {
	projectId: string;
}

export function LogsTab({
	projectId,
}: LogsTabProps) {
	const { data } = useDeployments(projectId);
	const deployments = data?.items ?? [];
	const latest =
		deployments.find(
			(d) => d.status === "running",
		) ?? deployments[0];
	const [isLive, setIsLive] = useState(true);
	const [logSource, setLogSource] = useState<
		"runtime" | "request"
	>("runtime");

	const [startDate, setStartDate] =
		useState<string>("");
	const [endDate, setEndDate] =
		useState<string>("");

	const startMs = startDate
		? new Date(startDate).getTime()
		: null;
	const endMs = endDate
		? new Date(endDate).getTime()
		: null;

	const {
		logs: runtimeLogs,
		isLoading: isRuntimeLoading,
		refetch: refetchRuntime,
	} = useRuntimeLogs(
		latest?.id || null,
		isLive && logSource === "runtime",
	);
	const {
		logs: requestLogs,
		isLoading: isRequestLoading,
		refetch: refetchRequest,
	} = useRequestLogs(
		projectId,
		isLive && logSource === "request",
		startMs,
		endMs,
	);

	const logs =
		logSource === "runtime"
			? runtimeLogs
			: requestLogs;
	const isLoading =
		logSource === "runtime"
			? isRuntimeLoading
			: isRequestLoading;
	const refetch =
		logSource === "runtime"
			? refetchRuntime
			: refetchRequest;

	const [searchQuery, setSearchQuery] =
		useState("");
	const [showInfo, setShowInfo] =
		useState(true);
	const [showWarning, setShowWarning] =
		useState(true);
	const [showError, setShowError] =
		useState(true);

	const [selectedLog, setSelectedLog] =
		useState<any | null>(null);

	const parsedLogs = logs.map(parseLogEntry);

	const filteredLogs = parsedLogs.filter(
		(log) => {
			if (
				searchQuery &&
				!log.message
					.toLowerCase()
					.includes(
						searchQuery.toLowerCase(),
					)
			) {
				return false;
			}
			if (
				log.level === "error" &&
				!showError
			)
				return false;
			if (
				log.level === "warning" &&
				!showWarning
			)
				return false;
			if (log.level === "info" && !showInfo)
				return false;
			return true;
		},
	);

	const makeHistogram = () => {
		const nowMs = Date.now();
		const bins = Array.from(
			{ length: 30 },
			(_, idx) => {
				const binStart =
					nowMs - (30 - idx) * 60000;
				const binEnd = binStart + 60000;
				return {
					start: binStart,
					end: binEnd,
					count: 0,
				};
			},
		);

		for (const log of filteredLogs) {
			const time = new Date(
				(log as any).timestamp ||
					log.createdAt,
			).getTime();
			for (const bin of bins) {
				if (
					time >= bin.start &&
					time < bin.end
				) {
					bin.count++;
					break;
				}
			}
		}
		return bins;
	};

	const bins = makeHistogram();
	const maxCount = Math.max(
		...bins.map((b) => b.count),
		1,
	);

	return (
		<div className="space-y-6">
			{/* Top Filters Header */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 border border-[#1a1a1f] bg-[#0c0c0e] rounded-xl select-none">
				<div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
					{/* Log Source Selector */}
					<div className="flex items-center justify-center bg-[#141417] p-1 rounded-lg border border-[#222227]">
						<button
							onClick={() =>
								setLogSource(
									"request",
								)
							}
							className={cn(
								"flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded-md transition-all text-center",
								logSource ===
									"request"
									? "bg-[#1c1c22] text-amber-500 border border-[#2c2c35] shadow"
									: "text-zinc-400 hover:text-zinc-200 border border-transparent",
							)}
						>
							Request Monitoring
						</button>
						<button
							onClick={() =>
								setLogSource(
									"runtime",
								)
							}
							className={cn(
								"flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded-md transition-all text-center",
								logSource ===
									"runtime"
									? "bg-[#1c1c22] text-amber-500 border border-[#2c2c35] shadow"
									: "text-zinc-400 hover:text-zinc-200 border border-transparent",
							)}
						>
							Runtime Logs
						</button>
					</div>

					{/* Search message */}
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
						<Input
							placeholder="Search logs..."
							value={searchQuery}
							onChange={(e) =>
								setSearchQuery(
									e.target
										.value,
								)
							}
							className="h-8 pl-8 bg-[#141417] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs w-full shadow-none"
						/>
					</div>

					{/* Severity Checkboxes */}
					<div className="flex items-center gap-3.5 text-xs text-zinc-400 font-medium">
						<label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200">
							<input
								type="checkbox"
								checked={showInfo}
								onChange={(e) =>
									setShowInfo(
										e.target
											.checked,
									)
								}
								className="rounded bg-[#141417] border-[#222227] text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
							/>
							Info
						</label>
						<label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200">
							<input
								type="checkbox"
								checked={
									showWarning
								}
								onChange={(e) =>
									setShowWarning(
										e.target
											.checked,
									)
								}
								className="rounded bg-[#141417] border-[#222227] text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
							/>
							Warning
						</label>
						<label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200">
							<input
								type="checkbox"
								checked={
									showError
								}
								onChange={(e) =>
									setShowError(
										e.target
											.checked,
									)
								}
								className="rounded bg-[#141417] border-[#222227] text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
							/>
							Error
						</label>
					</div>
				</div>

				<div className="flex items-center justify-between sm:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#1a1a1f]">
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						className="h-8 border-[#222227] text-zinc-400 hover:bg-[#1a1a1f] flex-1 sm:flex-none"
					>
						<RefreshCw className="h-3 w-3 mr-1" />{" "}
						Reload
					</Button>
					<Button
						onClick={() =>
							setIsLive(!isLive)
						}
						disabled={
							startDate !== "" ||
							endDate !== ""
						}
						className={cn(
							"h-8 text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all shadow-md flex-1 sm:flex-none",
							startDate !== "" ||
								endDate !== ""
								? "bg-[#141417] border-[#222227] text-zinc-650 cursor-not-allowed opacity-55"
								: isLive
									? "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20"
									: "bg-[#141417] border-[#222227] text-zinc-400 hover:bg-[#1c1c22]",
						)}
					>
						<span
							className={cn(
								"w-1.5 h-1.5 rounded-full bg-amber-500",
								isLive &&
									!(
										startDate !==
											"" ||
										endDate !==
											""
									) &&
									"animate-pulse",
							)}
						/>
						{isLive
							? "Live Streaming"
							: "Paused"}
					</Button>
				</div>
			</div>

			{/* Date Range Selection (Only for Request Monitoring) */}
			{logSource === "request" && (
				<div className="flex flex-wrap items-center gap-4 bg-[#0a0a0c] border border-[#1a1a1f] p-3 rounded-xl text-xs select-none">
					<div className="flex items-center gap-2">
						<span className="text-zinc-500 font-semibold">
							Date Filter:
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-4">
						<div className="flex items-center gap-2">
							<span className="text-zinc-500 font-mono text-[11px]">
								From
							</span>
							<input
								type="datetime-local"
								value={startDate}
								onChange={(e) =>
									setStartDate(
										e.target
											.value,
									)
								}
								className="bg-[#141417] border border-[#222227] rounded-md px-2.5 py-1 text-zinc-300 text-xs focus:outline-none focus:border-amber-500 font-mono"
							/>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-zinc-500 font-mono text-[11px]">
								To
							</span>
							<input
								type="datetime-local"
								value={endDate}
								onChange={(e) =>
									setEndDate(
										e.target
											.value,
									)
								}
								className="bg-[#141417] border border-[#222227] rounded-md px-2.5 py-1 text-zinc-300 text-xs focus:outline-none focus:border-amber-500 font-mono"
							/>
						</div>
						{(startDate ||
							endDate) && (
							<div className="flex items-center gap-3">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setStartDate(
											"",
										);
										setEndDate(
											"",
										);
									}}
									className="h-7 px-2 text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1c22] font-mono text-[10px] border border-[#222227]"
								>
									<X className="h-3 w-3 mr-1" />{" "}
									Reset Filter
								</Button>
								<span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold animate-pulse">
									Streaming
									Paused
								</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Log count Timeline Chart */}
			<LogsTimelineDistribution
				logSource={logSource}
				bins={bins}
				maxCount={maxCount}
			/>

			{/* Logs Table Layout */}
			<div className="flex gap-4 items-start relative min-h-[400px]">
				<LogsEventsTable
					logSource={logSource}
					isLoading={isLoading}
					filteredLogs={filteredLogs}
					selectedLog={selectedLog}
					onSelectLog={(log) => setSelectedLog(log)}
				/>

				<LogDetailSheet
					selectedLog={selectedLog}
					onClose={() => setSelectedLog(null)}
					logSource={logSource}
				/>
			</div>
		</div>
	);
}
