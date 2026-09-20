import { Code2 } from "lucide-react";
import type { QueryExecResult } from "../../../types";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface SqlQueryViewProps {
	sqlQuery: string;
	onQueryChange: (val: string) => void;
	onExecute: () => void;
	isExecuting: boolean;
	sqlResult: QueryExecResult | null;
	sqlError: string | null;
}

export function SqlQueryView({
	sqlQuery,
	onQueryChange,
	onExecute,
	isExecuting,
	sqlResult,
	sqlError,
}: SqlQueryViewProps) {
	return (
		<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-xl">
			<div className="flex items-center justify-between border-b border-border/40 pb-3">
				<span className="text-xs font-bold text-foreground flex items-center gap-2">
					<Code2 className="h-4 w-4 text-orange-400" />
					Custom SQL Console
				</span>
				<Button
					onClick={onExecute}
					disabled={isExecuting || !sqlQuery.trim()}
					size="sm"
					className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-8 px-4 rounded-xl shadow-md"
				>
					{isExecuting ? "Executing..." : "Run Query"}
				</Button>
			</div>

			<textarea
				value={sqlQuery}
				onChange={(e) => onQueryChange(e.target.value)}
				rows={12}
				placeholder="Type or paste SQL queries..."
				className="w-full bg-black/50 border border-border/60 rounded-2xl p-4 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 min-h-[260px] resize-y"
			/>

			{sqlError && (
				<div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">
					{sqlError}
				</div>
			)}

			{sqlResult && (
				<div className="space-y-2 pt-2">
					<Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
						{sqlResult.rows.length} rows returned ({sqlResult.executionTimeMs} ms)
					</Badge>
					<pre className="bg-black/40 border border-border/40 p-4 rounded-2xl font-mono text-xs text-foreground overflow-x-auto max-h-80">
						{JSON.stringify(sqlResult.rows, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}
