import { Boxes, Plus, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import type { TableInfo } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/dialog";
import { Input } from "../../../ui/input";

interface MongoCollectionSidebarProps {
	collections: TableInfo[];
	selectedCollection: string | null;
	onSelectCollection: (name: string) => void;
	onRefresh: () => void;
	onCreateCollection: (name: string) => Promise<void>;
	isLoading: boolean;
	databaseName: string;
}

export function MongoCollectionSidebar({
	collections,
	selectedCollection,
	onSelectCollection,
	onRefresh,
	onCreateCollection,
	isLoading,
	databaseName,
}: MongoCollectionSidebarProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newCollectionName, setNewCollectionName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	const filtered = collections.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = newCollectionName.trim();
		if (!name) return;
		setIsCreating(true);
		setCreateError(null);
		try {
			await onCreateCollection(name);
			setNewCollectionName("");
			setShowCreateModal(false);
		} catch (err: any) {
			setCreateError(err.message || "Failed to create collection");
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<div className="lg:col-span-1 border border-border/60 bg-card/60 rounded-3xl p-4 space-y-4 backdrop-blur-md shadow-xl flex flex-col justify-between">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
						<Boxes className="h-4 w-4 text-emerald-400" />
						Collections
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowCreateModal(true)}
							className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-400 rounded-lg"
							title="New Collection"
						>
							<Plus className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={onRefresh}
							className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
							title="Refresh Collections"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
						</Button>
					</div>
				</div>

				<div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-xl border border-border/40">
					<Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search collections..."
						className="w-full bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground"
					/>
				</div>

				<div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
					{filtered.length === 0 ? (
						<p className="text-[11px] text-muted-foreground py-6 text-center">No collections found.</p>
					) : (
						filtered.map((c) => {
							const isSelected = selectedCollection === c.name;
							return (
								<button
									key={c.name}
									type="button"
									onClick={() => onSelectCollection(c.name)}
									className={`w-full text-left font-mono text-xs px-3 py-2.5 rounded-xl transition-all flex items-center justify-between border ${
										isSelected
											? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border-emerald-500/50 text-emerald-300 font-semibold shadow-md"
											: "bg-background/20 border-transparent text-foreground hover:bg-white/5"
									}`}
								>
									<span className="truncate">{c.name}</span>
									<Badge
										variant="outline"
										className="text-[9px] px-1.5 py-0 border-border/60 text-muted-foreground font-mono"
									>
										{typeof c.rowCount === "number" ? `${c.rowCount} docs` : "collection"}
									</Badge>
								</button>
							);
						})
					)}
				</div>
			</div>

			<div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
				<span className="truncate max-w-[130px]">DB: {databaseName}</span>
				<span>{collections.length} Collections</span>
			</div>

			{/* Create Collection Dialog */}
			<Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
				<DialogContent className="sm:max-w-md bg-card border-border/80 text-foreground rounded-2xl shadow-2xl">
					<form onSubmit={handleCreate} className="space-y-4">
						<DialogHeader>
							<DialogTitle className="text-base font-semibold flex items-center gap-2">
								<Boxes className="h-4 w-4 text-emerald-400" /> Create Collection
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Add a new document collection to the MongoDB database.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-2">
							<label className="text-xs font-medium text-foreground">Collection Name</label>
							<Input
								value={newCollectionName}
								onChange={(e) => setNewCollectionName(e.target.value)}
								placeholder="e.g. orders, users, audit_logs"
								className="bg-card border-border/80 font-mono text-xs"
								autoFocus
							/>
						</div>

						{createError && <p className="text-xs text-red-400">{createError}</p>}

						<DialogFooter className="gap-2 sm:gap-0">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setShowCreateModal(false)}
								className="text-xs"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								size="sm"
								disabled={isCreating || !newCollectionName.trim()}
								className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
							>
								{isCreating ? "Creating…" : "Create Collection"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
