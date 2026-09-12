import { useQuery } from "@tanstack/react-query";
import { Check, Code2, Download, Play, RefreshCw, ShieldAlert, Table as TableIcon } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import type { Database, QueryExecResult } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface QueryEditorProps {
	database: Database;
}

export function QueryEditor({ database }: QueryEditorProps) {
	const [query, setQuery] = useState(
		database.type === "postgresql"
			? "SELECT * FROM information_schema.tables WHERE table_schema='public';"
			: database.type === "mysql"
				? "SHOW TABLES;"
				: database.type === "mongodb"
					? "db.getCollectionNames()"
					: "KEYS *",
	);

	const [isExecuting, setIsExecuting] = useState(false);
	const [result, setResult] = useState<QueryExecResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"table" | "json">("table");

	const {
		data: tables = [],
		refetch: refetchTables,
		isLoading: isLoadingTables,
	} = useQuery({
		queryKey: ["database-tables", database.id],
		queryFn: () => api.getDatabaseTables(database.id).catch(() => []),
	});

	const handleExecute = async () => {
		if (!query.trim()) return;
		setIsExecuting(true);
		setError(null);
		try {
			const res = await api.queryDatabase(database.id, query);
			setResult(res);
		} catch (err: any) {
			setError(err.message || "Query execution failed");
			setResult(null);
		} finally {
			setIsExecuting(false);
		}
	};

	const handleSelectTable = (tableName: string) => {
		if (database.type === "postgresql") {
			setQuery(`SELECT * FROM "${tableName}" LIMIT 50;`);
		} else if (database.type === "mysql") {
			setQuery(`SELECT * FROM \`${tableName}\` LIMIT 50;`);
		} else if (database.type === "mongodb") {
			setQuery(`db.${tableName}.find().limit(50)`);
		} else {
			setQuery(`GET ${tableName}`);
		}
	};

	const exportJson = () => {
		if (!result) return;
		const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${database.name}-query-results.json`;
		a.click();
	};

	const exportCsv = () => {
		if (!result || result.rows.length === 0) return;
		const headers = result.columns.join(",");
		const rows = result.rows.map((row) =>
			result.columns
				.map((col) => {
					const val = row[col];
					return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : String(val ?? "");
				})
				.join(","),
		);
		const csv = [headers, ...rows].join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${database.name}-query-results.csv`;
		a.click();
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
			{/* Tables Sidebar */}
			<div className="lg:col-span-1 border border-border/60 bg-card/60 rounded-3xl p-4 space-y-3 backdrop-blur-md">
				<div className="flex items-center justify-between">
					<span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
						<TableIcon className="h-4 w-4 text-orange-400" />
						Schema Browser ({tables.length})
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => refetchTables()}
						className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${isLoadingTables ? "animate-spin" : ""}`} />
					</Button>
				</div>

				<div className="space-y-1 max-h-96 overflow-y-auto pr-1">
					{tables.length === 0 ? (
						<p className="text-[11px] text-muted-foreground py-4 text-center">No tables or collections detected.</p>
					) : (
						tables.map((t) => (
							<button
								key={t.name}
								type="button"
								onClick={() => handleSelectTable(t.name)}
								className="w-full text-left font-mono text-xs px-3 py-2 rounded-xl bg-background/30 hover:bg-orange-500/10 hover:border-orange-500/30 border border-transparent transition-all flex items-center justify-between text-foreground"
							>
								<span className="truncate">{t.name}</span>
								<Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border/60 text-muted-foreground">
									{t.type || "table"}
								</Badge>
							</button>
						))
					)}
				</div>
			</div>

			{/* Query Console & Results Area */}
			<div className="lg:col-span-3 space-y-4">
				{/* Query Textarea Box */}
				<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-3 backdrop-blur-md shadow-xl">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
						<span className="text-xs font-bold text-foreground flex items-center gap-2">
							<Code2 className="h-4 w-4 text-orange-400" />
							Interactive SQL / Query Console
						</span>

						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									setQuery(
										database.type === "postgresql"
											? "SELECT * FROM information_schema.tables WHERE table_schema='public';"
											: database.type === "mysql"
												? "SHOW TABLES;"
												: database.type === "mongodb"
													? "db.getCollectionNames()"
													: "KEYS *",
									)
								}
								className="text-[11px] h-8 px-2.5 text-muted-foreground hover:text-foreground"
							>
								Reset Template
							</Button>
							<Button
								onClick={handleExecute}
								disabled={isExecuting || !query.trim()}
								size="sm"
								className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-8 px-4 rounded-xl shadow-md gap-1.5"
							>
								<Play className={`h-3.5 w-3.5 fill-current ${isExecuting ? "animate-spin" : ""}`} />
								{isExecuting ? "Executing..." : "Run Query"}
							</Button>
						</div>
					</div>

					<textarea
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Enter SQL query or command..."
						rows={4}
						className="w-full bg-black/40 border border-border/60 rounded-2xl p-4 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-y"
					/>
				</div>

				{/* Error display */}
				{error && (
					<div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
						<ShieldAlert className="h-4 w-4 shrink-0" />
						<span className="font-mono">{error}</span>
					</div>
				)}

				{/* Query Results */}
				{result && (
					<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-xl">
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
							<div className="flex items-center gap-3">
								<span className="text-xs font-bold text-foreground">Query Execution Results</span>
								<Badge
									variant="outline"
									className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
								>
									{result.rows.length} rows ({result.executionTimeMs} ms)
								</Badge>
							</div>

							<div className="flex items-center gap-2">
								<Button
									variant={viewMode === "table" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setViewMode("table")}
									className="text-[11px] h-7 px-2.5 rounded-lg"
								>
									Table
								</Button>
								<Button
									variant={viewMode === "json" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setViewMode("json")}
									className="text-[11px] h-7 px-2.5 rounded-lg"
								>
									JSON
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={exportCsv}
									className="text-[11px] h-7 px-2.5 rounded-lg border-border/60 gap-1"
								>
									<Download className="h-3 w-3" /> CSV
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={exportJson}
									className="text-[11px] h-7 px-2.5 rounded-lg border-border/60 gap-1"
								>
									<Download className="h-3 w-3" /> JSON
								</Button>
							</div>
						</div>

						{viewMode === "json" ? (
							<pre className="bg-black/40 border border-border/40 p-4 rounded-2xl font-mono text-xs text-foreground overflow-x-auto max-h-96">
								{JSON.stringify(result.rows, null, 2)}
							</pre>
						) : result.rows.length === 0 ? (
							<p className="text-xs text-muted-foreground py-6 text-center">
								Query executed successfully with 0 rows returned.
							</p>
						) : (
							<div className="overflow-x-auto max-h-96 rounded-2xl border border-border/40">
								<table className="w-full text-left font-mono text-xs border-collapse">
									<thead className="bg-black/40 text-muted-foreground border-b border-border/40 sticky top-0">
										<tr>
											{result.columns.map((col) => (
												<th key={col} className="p-3 font-semibold">
													{col}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-border/20 bg-background/20">
										{result.rows.map((row, idx) => (
											<tr key={idx} className="hover:bg-orange-500/5">
												{result.columns.map((col) => (
													<td key={col} className="p-3 text-foreground whitespace-nowrap max-w-xs truncate">
														{row[col] !== null && typeof row[col] === "object"
															? JSON.stringify(row[col])
															: String(row[col] ?? "null")}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
