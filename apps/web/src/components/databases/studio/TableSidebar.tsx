import { RefreshCw, Search, Table as TableIcon } from "lucide-react";
import type { TableInfo } from "../../../types";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface TableSidebarProps {
	tables: TableInfo[];
	selectedTable: string | null;
	onSelectTable: (tableName: string) => void;
	onRefresh: () => void;
	isLoading: boolean;
	searchQuery: string;
	onSearchChange: (query: string) => void;
}

export function TableSidebar({
	tables,
	selectedTable,
	onSelectTable,
	onRefresh,
	isLoading,
	searchQuery,
	onSearchChange,
}: TableSidebarProps) {
	const filteredTables = tables.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

	return (
		<div className="lg:col-span-1 border border-border/60 bg-card/60 rounded-3xl p-4 space-y-4 backdrop-blur-md shadow-xl flex flex-col justify-between">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
						<TableIcon className="h-4 w-4 text-orange-400" />
						Tables & Schemas
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={onRefresh}
						className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
					</Button>
				</div>

				<div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-xl border border-border/40">
					<Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Search tables..."
						className="w-full bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground"
					/>
				</div>

				<div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
					{filteredTables.length === 0 ? (
						<p className="text-[11px] text-muted-foreground py-6 text-center">No matching tables found.</p>
					) : (
						filteredTables.map((t) => {
							const isSelected = selectedTable === t.name;
							return (
								<button
									key={t.name}
									type="button"
									onClick={() => onSelectTable(t.name)}
									className={`w-full text-left font-mono text-xs px-3 py-2.5 rounded-xl transition-all flex items-center justify-between border ${
										isSelected
											? "bg-gradient-to-r from-orange-500/20 to-amber-500/10 border-orange-500/50 text-orange-400 font-semibold shadow-md"
											: "bg-background/20 border-transparent text-foreground hover:bg-white/5"
									}`}
								>
									<span className="truncate">{t.name}</span>
									<Badge
										variant="outline"
										className="text-[9px] px-1.5 py-0 border-border/60 text-muted-foreground font-mono"
									>
										{t.type || "table"}
									</Badge>
								</button>
							);
						})
					)}
				</div>
			</div>

			<div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
				<span>Schema: public</span>
				<span>{tables.length} Objects</span>
			</div>
		</div>
	);
}
