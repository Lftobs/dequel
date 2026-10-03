import { Database, Key, Plus, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import type { TableInfo } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";

interface RedisKeysSidebarProps {
	keys: TableInfo[];
	selectedKey: string | null;
	onSelectKey: (keyName: string) => void;
	onRefresh: () => void;
	onOpenNewKeyModal: () => void;
	isLoading: boolean;
	pattern: string;
	onPatternChange: (p: string) => void;
	onScan: () => void;
}

export function RedisKeysSidebar({
	keys,
	selectedKey,
	onSelectKey,
	onRefresh,
	onOpenNewKeyModal,
	isLoading,
	pattern,
	onPatternChange,
	onScan,
}: RedisKeysSidebarProps) {
	const getTypeColor = (type?: string) => {
		switch (type?.toLowerCase()) {
			case "string":
				return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10";
			case "hash":
				return "border-orange-500/30 text-orange-400 bg-orange-500/10";
			case "list":
				return "border-sky-500/30 text-sky-400 bg-sky-500/10";
			case "set":
				return "border-purple-500/30 text-purple-400 bg-purple-500/10";
			case "zset":
				return "border-amber-500/30 text-amber-400 bg-amber-500/10";
			default:
				return "border-border/60 text-muted-foreground";
		}
	};

	return (
		<div className="lg:col-span-1 border border-border/60 bg-card/60 rounded-3xl p-4 space-y-4 backdrop-blur-md shadow-xl flex flex-col justify-between">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
						<Key className="h-4 w-4 text-orange-400" />
						Keys &amp; Data
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={onOpenNewKeyModal}
							className="h-7 w-7 p-0 text-muted-foreground hover:text-orange-400 rounded-lg"
							title="New Key"
						>
							<Plus className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={onRefresh}
							className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
							title="Refresh Keys"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
						</Button>
					</div>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						onScan();
					}}
					className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-xl border border-border/40"
				>
					<Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
					<input
						type="text"
						value={pattern}
						onChange={(e) => onPatternChange(e.target.value)}
						placeholder="Search / pattern: e.g. *"
						className="w-full bg-transparent font-mono text-xs text-foreground focus:outline-none placeholder:text-muted-foreground"
					/>
				</form>

				<div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
					{keys.length === 0 ? (
						<p className="text-[11px] text-muted-foreground py-6 text-center">No keys found.</p>
					) : (
						keys.map((k) => {
							const isSelected = selectedKey === k.name;
							return (
								<button
									key={k.name}
									type="button"
									onClick={() => onSelectKey(k.name)}
									className={`w-full text-left font-mono text-xs px-3 py-2 rounded-xl transition-all flex items-center justify-between border ${
										isSelected
											? "bg-gradient-to-r from-orange-500/20 to-amber-500/10 border-orange-500/50 text-orange-400 font-semibold shadow-md"
											: "bg-background/20 border-transparent text-foreground hover:bg-white/5"
									}`}
								>
									<span className="truncate pr-2">{k.name}</span>
									<Badge
										variant="outline"
										className={`text-[9px] px-1.5 py-0 font-mono uppercase shrink-0 ${getTypeColor(k.type)}`}
									>
										{k.type || "string"}
									</Badge>
								</button>
							);
						})
					)}
				</div>
			</div>

			<div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
				<span>Database: 0</span>
				<span>{keys.length} Keys Loaded</span>
			</div>
		</div>
	);
}
