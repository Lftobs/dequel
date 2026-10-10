import { Play, Terminal } from "lucide-react";
import type { QueryExecResult } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";

interface MongoShellViewProps {
	selectedCollection: string | null;
	queryText: string;
	onQueryChange: (val: string) => void;
	onExecute: () => void;
	isExecuting: boolean;
	result: QueryExecResult | null;
	error: string | null;
}

export function MongoShellView({
	selectedCollection,
	queryText,
	onQueryChange,
	onExecute,
	isExecuting,
	result,
	error,
}: MongoShellViewProps) {
	const col = selectedCollection || "collection";

	const snippets = [
		{ label: "find().limit(20)", code: `db.${col}.find().limit(20)` },
		{ label: "countDocuments()", code: `db.${col}.countDocuments()` },
		{ label: "aggregate([])", code: `db.${col}.aggregate([\n  { $match: {} },\n  { $limit: 10 }\n])` },
		{ label: "stats()", code: `db.${col}.stats()` },
		{ label: "getCollectionNames()", code: "db.getCollectionNames()" },
	];

	return (
		<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-xl">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
				<div>
					<span className="text-xs font-bold text-foreground flex items-center gap-2">
						<Terminal className="h-4 w-4 text-orange-400" />
						MongoDB Shell Console
					</span>
					<p className="text-[11px] text-muted-foreground mt-0.5">
						Execute raw JavaScript expressions &amp; database commands against the mongosh engine
					</p>
				</div>

				<Button
					onClick={onExecute}
					disabled={isExecuting || !queryText.trim()}
					size="sm"
					className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-8 px-4 rounded-xl shadow-md gap-1.5 self-start sm:self-auto"
				>
					<Play className="h-3.5 w-3.5 fill-current" />
					{isExecuting ? "Executing…" : "Run Query"}
				</Button>
			</div>

			{/* Snippet chips */}
			<div className="flex items-center gap-1.5 flex-wrap">
				<span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider mr-1">Snippets:</span>
				{snippets.map((snip) => (
					<button
						key={snip.label}
						type="button"
						onClick={() => onQueryChange(snip.code)}
						className="rounded-lg border border-border/60 bg-black/40 px-2 py-1 text-[11px] font-mono text-zinc-300 hover:text-orange-400 hover:border-orange-500/40 transition-colors"
					>
						{snip.label}
					</button>
				))}
			</div>

			<textarea
				value={queryText}
				onChange={(e) => onQueryChange(e.target.value)}
				rows={8}
				placeholder={`db.${col}.find({}).limit(10)`}
				className="w-full bg-black/50 border border-border/60 rounded-2xl p-4 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 min-h-[160px] resize-y"
			/>

			{error && (
				<div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">
					{error}
				</div>
			)}

			{result && (
				<div className="space-y-2 pt-2">
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="text-[10px] font-mono border-orange-500/30 text-orange-400">
							{result.rows.length} {result.rows.length === 1 ? "result" : "results"} ({result.executionTimeMs} ms)
						</Badge>
					</div>
					<pre className="bg-black/50 border border-border/50 p-4 rounded-2xl font-mono text-xs text-foreground overflow-x-auto max-h-96 leading-relaxed">
						{result.rawOutput || JSON.stringify(result.rows, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}
