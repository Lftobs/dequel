import { Play, Terminal, Trash2 } from "lucide-react";
import { useState } from "react";
import * as api from "../../../../api/client";
import type { QueryExecResult } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";

interface RedisCliViewProps {
	databaseId: string;
	initialCommand?: string;
}

interface CliHistoryEntry {
	id: string;
	command: string;
	result: QueryExecResult | null;
	error: string | null;
	timestamp: string;
}

export function RedisCliView({ databaseId, initialCommand }: RedisCliViewProps) {
	const [commandInput, setCommandInput] = useState(initialCommand || "INFO");
	const [isExecuting, setIsExecuting] = useState(false);
	const [history, setHistory] = useState<CliHistoryEntry[]>([]);

	const snippets = [
		{ label: "INFO", cmd: "INFO" },
		{ label: "DBSIZE", cmd: "DBSIZE" },
		{ label: "KEYS *", cmd: "KEYS *" },
		{ label: "CLIENT LIST", cmd: "CLIENT LIST" },
		{ label: "PING", cmd: "PING" },
		{ label: "SLOWLOG GET 10", cmd: "SLOWLOG GET 10" },
		{ label: "TIME", cmd: "TIME" },
		{ label: "MEMORY STATS", cmd: "MEMORY STATS" },
	];

	const handleExecute = async () => {
		const cmd = commandInput.trim();
		if (!cmd) return;
		setIsExecuting(true);

		const entryId = Math.random().toString(36).substring(7);
		const timeStr = new Date().toLocaleTimeString();

		try {
			const res = await api.queryDatabase(databaseId, cmd);
			setHistory((prev) => [
				{
					id: entryId,
					command: cmd,
					result: res,
					error: null,
					timestamp: timeStr,
				},
				...prev,
			]);
		} catch (err: any) {
			setHistory((prev) => [
				{
					id: entryId,
					command: cmd,
					result: null,
					error: err.message || "Command execution failed",
					timestamp: timeStr,
				},
				...prev,
			]);
		} finally {
			setIsExecuting(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleExecute();
		}
	};

	return (
		<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-xl">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
				<div>
					<span className="text-xs font-bold text-foreground flex items-center gap-2">
						<Terminal className="h-4 w-4 text-orange-400" />
						Redis Command Line Interface (CLI)
					</span>
					<p className="text-[11px] text-muted-foreground mt-0.5">
						Execute native Redis commands directly against the instance (supports multi-line batch commands)
					</p>
				</div>

				<div className="flex items-center gap-2">
					{history.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setHistory([])}
							className="h-8 text-xs text-muted-foreground hover:text-foreground"
							title="Clear console log"
						>
							<Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
						</Button>
					)}
					<Button
						onClick={handleExecute}
						disabled={isExecuting || !commandInput.trim()}
						size="sm"
						className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-8 px-4 rounded-xl shadow-md gap-1.5"
					>
						<Play className="h-3.5 w-3.5 fill-current" />
						{isExecuting ? "Executing…" : "Execute"}
					</Button>
				</div>
			</div>

			<div className="flex items-center gap-1.5 flex-wrap">
				<span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider mr-1">
					Quick Commands:
				</span>
				{snippets.map((snip) => (
					<button
						key={snip.label}
						type="button"
						onClick={() => setCommandInput(snip.cmd)}
						className="rounded-lg border border-border/60 bg-black/40 px-2 py-1 text-[11px] font-mono text-zinc-300 hover:text-orange-400 hover:border-orange-500/40 transition-colors"
					>
						{snip.label}
					</button>
				))}
			</div>

			<div className="relative">
				<textarea
					value={commandInput}
					onChange={(e) => setCommandInput(e.target.value)}
					onKeyDown={handleKeyDown}
					rows={3}
					placeholder="Enter Redis command (e.g. GET key, HGETALL user:1, DBSIZE). Press Enter to run, Shift+Enter for new line."
					className="w-full bg-black/70 border border-border/60 rounded-2xl p-4 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-y leading-relaxed"
				/>
			</div>

			{/* Terminal Output Stream */}
			<div className="space-y-3">
				{history.length === 0 ? (
					<div className="p-8 border border-border/30 rounded-2xl bg-black/30 text-center font-mono text-xs text-muted-foreground">
						No commands executed yet. Select a quick command or type in the input above.
					</div>
				) : (
					history.map((entry) => (
						<div
							key={entry.id}
							className="rounded-2xl border border-border/50 bg-black/70 overflow-hidden font-mono text-xs shadow-lg"
						>
							<div className="p-2.5 bg-black/90 border-b border-border/30 flex items-center justify-between text-muted-foreground text-[11px]">
								<div className="flex items-center gap-2">
									<span className="text-orange-400 font-bold">127.0.0.1:6379&gt;</span>
									<span className="text-foreground font-semibold break-all">{entry.command}</span>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									{entry.result && (
										<Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-500/30 text-orange-400">
											{entry.result.executionTimeMs} ms
										</Badge>
									)}
									<span>{entry.timestamp}</span>
								</div>
							</div>

							<div className="p-3 max-h-72 overflow-y-auto leading-relaxed">
								{entry.error ? (
									<span className="text-red-400">{entry.error}</span>
								) : (
									<pre className="text-zinc-200 whitespace-pre-wrap break-all">
										{entry.result?.rawOutput ||
											(entry.result?.rows || []).map((r) => `${r.result ?? ""}`).join("\n") ||
											"(empty response)"}
									</pre>
								)}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
