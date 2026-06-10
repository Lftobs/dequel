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

function stripAnsi(str: string): string {
	// Strip full ANSI escape sequences (ESC + bracket + params + terminator)
	let s = str.replace(
		/[\u001b\u009b]\[[\d;]*[A-Za-z]/g,
		"",
	);
	// Strip orphaned bracket sequences where ESC byte was already removed (e.g. "[35m", "[0m")
	s = s.replace(/\[(\d+;)*\d*m/g, "");
	return s;
}

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
	>("request");

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

	// Drawer state
	const [selectedLog, setSelectedLog] =
		useState<any | null>(null);

	// Parse logs
	const parsedLogs = logs.map((log) => {
		let message = stripAnsi(log.message);
		let level = "info";
		let status = "";
		let host = "localhost";
		let request = "";
		let duration: string | null = null;
		let size: string | null = null;
		let raw = log.message;

		if (
			message.startsWith("{") &&
			message.endsWith("}")
		) {
			try {
				const obj = JSON.parse(message);
				if (obj.level)
					level =
						obj.level.toLowerCase();
				if (obj.status) {
					status = String(obj.status);
					const statusNum = Number(
						obj.status,
					);
					if (statusNum >= 500)
						level = "error";
					else if (statusNum >= 400)
						level = "warning";
				}
				if (obj.request) {
					host =
						obj.request.host || host;
					request = `${obj.request.method || ""} ${obj.request.uri || ""}`;
					duration = obj.duration
						? `${(obj.duration * 1000).toFixed(2)}ms`
						: null;
					size = obj.size
						? `${obj.size} B`
						: null;
					message =
						obj.msg ||
						obj.message ||
						obj.error ||
						message;
					if (
						!message ||
						message === '""'
					) {
						message = `${obj.request.method || ""} ${obj.request.uri || ""}`;
					}
				} else {
					message =
						obj.msg ||
						obj.message ||
						message;
				}
				raw = JSON.stringify(
					obj,
					null,
					2,
				);
			} catch {}
		} else {
			const upper = message.toUpperCase();
			if (
				upper.includes("ERROR") ||
				upper.includes("CRITICAL") ||
				upper.includes("FAIL")
			)
				level = "error";
			else if (upper.includes("WARN"))
				level = "warning";
		}

		return {
			...log,
			parsedMessage: message,
			level,
			status,
			host,
			request,
			duration,
			size,
			raw,
		};
	});

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
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-[#1a1a1f] bg-[#0c0c0e] rounded-xl select-none">
				<div className="flex flex-wrap items-center gap-4">
					{/* Log Source Selector */}
					<div className="flex items-center bg-[#141417] p-1 rounded-lg border border-[#222227] mr-2">
						<button
							onClick={() =>
								setLogSource(
									"request",
								)
							}
							className={cn(
								"px-3 py-1 text-xs font-semibold rounded-md transition-all",
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
								"px-3 py-1 text-xs font-semibold rounded-md transition-all",
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
					<div className="relative w-64">
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

				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						className="h-8 border-[#222227] text-zinc-450 hover:bg-[#1a1a1f]"
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
							"h-8 text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all shadow-md",
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

			{/* Logs Table Layout */}
			<div className="flex gap-4 items-start relative min-h-[400px]">
				<div className="flex-1 overflow-hidden border border-[#1a1a1f] bg-[#0c0c0e] rounded-xl">
					<div className="overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-[11px] leading-relaxed">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="border-b border-[#18181c] bg-[#111113] text-zinc-500 select-none">
									<th className="py-2.5 px-4 font-semibold w-24">
										Time
									</th>
									<th className="py-2.5 px-3 font-semibold w-20">
										Level
									</th>
								{logSource ===
									"request" && (
									<>
										<th className="py-2.5 px-3 font-semibold w-16">
											Status
										</th>
										<th className="py-2.5 px-3 font-semibold w-28">
											Host
										</th>
										<th className="py-2.5 px-3 font-semibold w-36">
											Request
										</th>
									</>
								)}
									<th className="py-2.5 px-4 font-semibold">
										Message
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#121216]">
								{isLoading ? (
									<tr>
										<td
											colSpan={
												5
											}
											className="py-8 text-center text-zinc-600"
										>
											Loading
											logs...
										</td>
									</tr>
								) : filteredLogs.length ===
								  0 ? (
									<tr>
										<td
											colSpan={
												5
											}
											className="py-8 text-center text-zinc-500"
										>
											{logSource ===
											"request"
												? "No request logs found."
												: "No runtime logs found."}
										</td>
									</tr>
								) : (
									filteredLogs.map(
										(
											log,
											idx,
										) => (
											<tr
												key={
													idx
												}
												onClick={() =>
													setSelectedLog(
														log,
													)
												}
												className={cn(
													"hover:bg-[#141418] cursor-pointer transition-colors border-l-2",
													log.level ===
														"error"
														? "border-l-red-500 hover:border-l-red-400"
														: log.level ===
															  "warning"
															? "border-l-amber-500 hover:border-l-amber-400"
															: "border-l-transparent hover:border-l-zinc-700",
													selectedLog?.id ===
														log.id &&
														"bg-[#16161b] hover:bg-[#16161b]",
												)}
											>
												<td className="py-2 px-4 text-zinc-500 whitespace-nowrap">
													{new Date(
														(
															log as any
														)
															.timestamp ||
															log.createdAt,
													).toLocaleTimeString()}
												</td>
												<td className="py-2 px-3">
													<span
														className={cn(
															"px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
															log.level ===
																"error"
																? "bg-red-500/10 text-red-400 border border-red-500/20"
																: log.level ===
																	  "warning"
																	? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
																	: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
														)}
													>
														{
															log.level
														}
													</span>
												</td>
												{logSource ===
													"request" && (
													<>
														<td className="py-2 px-3">
															{log.status ? (
																<span className={cn(
																	"inline-block px-1.5 py-0.5 rounded text-[9px] font-bold font-sans",
																	Number(log.status) >= 500
																		? "bg-red-500/10 text-red-400 border border-red-500/20"
																		: Number(log.status) >= 400
																			? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
																			: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
																)}>
																	{log.status}
																</span>
															) : (
																<span className="text-zinc-600">—</span>
															)}
														</td>
														<td className="py-2 px-3 text-zinc-400 truncate max-w-[110px]">
															{
																log.host
															}
														</td>
														<td className="py-2 px-3 text-zinc-400 truncate max-w-[140px]">
															{
																log.request
															}
														</td>
													</>
												)}
												<td className="py-2 px-4 text-zinc-300 break-all max-w-lg truncate">
													{
														log.parsedMessage
													}
												</td>
											</tr>
										),
									)
								)}
							</tbody>
						</table>
					</div>
				</div>

				{selectedLog && (
					<div className="w-[360px] border border-[#27272a] bg-[#111113] rounded-xl p-5 space-y-4 animate-in slide-in-from-right-3 duration-250 shrink-0 shadow-2xl relative">
						<button
							onClick={() =>
								setSelectedLog(
									null,
								)
							}
							className="absolute top-4 right-4 w-6 h-6 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-250 flex items-center justify-center transition-colors"
						>
							<X className="h-3.5 w-3.5" />
						</button>

						<div>
							<h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
								Log Event Details
							</h4>
							<span
								className={cn(
									"px-2 py-0.5 rounded text-[10px] font-bold uppercase",
									selectedLog.level ===
										"error"
										? "bg-red-500/10 text-red-400 border border-red-500/20"
										: selectedLog.level ===
											  "warning"
											? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
											: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
								)}
							>
								{
									selectedLog.level
								}
							</span>
						</div>

						<div className="space-y-3 font-mono text-[11px]">
							<div className="space-y-1">
								<div className="text-zinc-500 text-[10px] uppercase font-sans">
									Timestamp
								</div>
								<div className="text-zinc-300">
									{new Date(
										(
											selectedLog as any
										)
											.timestamp ||
											selectedLog.createdAt,
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
									{
										selectedLog.parsedMessage
									}
								</div>
							</div>

							<div className="space-y-1">
								<div className="text-zinc-500 text-[10px] uppercase font-sans">
									Raw JSON
									payload
								</div>
								<pre className="p-3 rounded bg-[#070708] border border-[#1e1e22] text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[220px]">
									{
										selectedLog.raw
									}
								</pre>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
