import { cn } from "../../../lib/utils";

interface LogsEventsTableProps {
	logSource: "runtime" | "request";
	isLoading: boolean;
	filteredLogs: any[];
	selectedLog: any;
	onSelectLog: (log: any) => void;
}

export function LogsEventsTable({
	logSource,
	isLoading,
	filteredLogs,
	selectedLog,
	onSelectLog,
}: LogsEventsTableProps) {
	return (
		<div className="flex-1 overflow-hidden border border-[#1a1a1f] bg-[#0c0c0e] rounded-xl">
			<div className="overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-[11px] leading-relaxed">
				<table className="w-full text-left border-collapse min-w-[500px] sm:min-w-full">
					<thead>
						<tr className="border-b border-[#18181c] bg-[#111113] text-zinc-500 select-none">
							<th className="py-2.5 px-4 font-semibold w-24">Time</th>
							<th className="py-2.5 px-3 font-semibold w-20">Level</th>
							{logSource === "request" && (
								<>
									<th className="py-2.5 px-3 font-semibold w-16">Status</th>
									<th className="py-2.5 px-3 font-semibold w-28">Host</th>
									<th className="py-2.5 px-3 font-semibold w-36">Request</th>
								</>
							)}
							<th className="py-2.5 px-4 font-semibold">Message</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-[#121216]">
						{isLoading ? (
							<tr>
								<td colSpan={5} className="py-8 text-center text-zinc-600">
									Loading logs...
								</td>
							</tr>
						) : filteredLogs.length === 0 ? (
							<tr>
								<td colSpan={5} className="py-8 text-center text-zinc-500">
									{logSource === "request" ? "No request logs found." : "No runtime logs found."}
								</td>
							</tr>
						) : (
							filteredLogs.map((log, idx) => (
								<tr
									key={idx}
									onClick={() => onSelectLog(log)}
									className={cn(
										"hover:bg-[#141418] cursor-pointer transition-colors border-l-2",
										log.level === "error"
											? "border-l-red-500 hover:border-l-red-400"
											: log.level === "warning"
												? "border-l-amber-500 hover:border-l-amber-400"
												: "border-l-transparent hover:border-l-zinc-700",
										selectedLog?.id === log.id && "bg-[#16161b] hover:bg-[#16161b]",
									)}
								>
									<td className="py-2 px-4 text-zinc-500 whitespace-nowrap">
										{new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
									</td>
									<td className="py-2 px-3">
										<span
											className={cn(
												"px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
												log.level === "error"
													? "bg-red-500/10 text-red-400 border border-red-500/20"
													: log.level === "warning"
														? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
														: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
											)}
										>
											{log.level}
										</span>
									</td>
									{logSource === "request" && (
										<>
											<td className="py-2 px-3">
												{log.status ? (
													<span
														className={cn(
															"inline-block px-1.5 py-0.5 rounded text-[9px] font-bold font-sans",
															Number(log.status) >= 500
																? "bg-red-500/10 text-red-400 border border-red-500/20"
																: Number(log.status) >= 400
																	? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
																	: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
														)}
													>
														{log.status}
													</span>
												) : (
													<span className="text-zinc-600">—</span>
												)}
											</td>
											<td className="py-2 px-3 text-zinc-400 truncate max-w-[110px]">
												{log.host}
											</td>
											<td className="py-2 px-3 text-zinc-400 truncate max-w-[140px]">
												{log.request}
											</td>
										</>
									)}
									<td className="py-2 px-4 text-zinc-300 break-all max-w-lg truncate">
										{log.parsedMessage}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
