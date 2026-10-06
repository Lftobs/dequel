import { Layers, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../../../api/client";
import type { Database } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/dialog";
import { Input } from "../../../ui/input";

interface MongoIndexesViewProps {
	database: Database;
	selectedCollection: string | null;
}

export function MongoIndexesView({ database, selectedCollection }: MongoIndexesViewProps) {
	const [indexes, setIndexes] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [showCreateModal, setShowCreateModal] = useState(false);
	const [indexKeyJson, setIndexKeyJson] = useState('{\n  "createdAt": -1\n}');
	const [isUnique, setIsUnique] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

	const loadIndexes = async () => {
		if (!selectedCollection) return;
		setIsLoading(true);
		setError(null);
		try {
			const res = await api.queryDatabase(database.id, `db.${selectedCollection}.getIndexes()`);
			setIndexes(Array.isArray(res.rows) ? res.rows : []);
		} catch (err: any) {
			setError(err.message || "Failed to load indexes");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		loadIndexes();
	}, [selectedCollection]);

	const handleCreateIndex = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedCollection) return;
		let keyObj: any;
		try {
			keyObj = JSON.parse(indexKeyJson);
		} catch {
			setError("Invalid JSON format for index keys");
			return;
		}

		setIsCreating(true);
		setError(null);
		const options = isUnique ? ", { unique: true }" : "";
		const query = `db.${selectedCollection}.createIndex(${JSON.stringify(keyObj)}${options})`;

		try {
			await api.queryDatabase(database.id, query);
			setShowCreateModal(false);
			loadIndexes();
		} catch (err: any) {
			setError(err.message || "Failed to create index");
		} finally {
			setIsCreating(false);
		}
	};

	const handleDropIndex = async (indexName: string) => {
		if (!selectedCollection || indexName === "_id_") return;
		setError(null);
		try {
			await api.queryDatabase(database.id, `db.${selectedCollection}.dropIndex("${indexName}")`);
			loadIndexes();
		} catch (err: any) {
			setError(err.message || "Failed to drop index");
		}
	};

	return (
		<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-xl">
			<div className="flex items-center justify-between border-b border-border/40 pb-3">
				<div>
					<h3 className="text-xs font-bold text-foreground flex items-center gap-2">
						<Layers className="h-4 w-4 text-orange-400" />
						Indexes for &quot;{selectedCollection || "collection"}&quot;
					</h3>
					<p className="text-[11px] text-muted-foreground mt-0.5">
						Secondary indexes speed up queries on specified fields
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={loadIndexes}
						className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
					</Button>
					<Button
						size="sm"
						onClick={() => setShowCreateModal(true)}
						disabled={!selectedCollection}
						className="bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-xl gap-1.5 shadow-md h-8"
					>
						<Plus className="h-3.5 w-3.5" /> Create Index
					</Button>
				</div>
			</div>

			{error && <p className="text-xs text-red-400 font-mono p-3 bg-red-500/10 rounded-xl">{error}</p>}

			{isLoading ? (
				<div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
					<RefreshCw className="h-4 w-4 animate-spin text-orange-400" /> Loading indexes…
				</div>
			) : indexes.length === 0 ? (
				<p className="text-xs text-muted-foreground py-8 text-center">No indexes found on this collection.</p>
			) : (
				<div className="overflow-x-auto rounded-2xl border border-border/50 bg-black/30 font-mono text-xs">
					<table className="w-full text-left border-collapse">
						<thead className="bg-zinc-900/80 text-muted-foreground border-b border-border/50">
							<tr>
								<th className="p-3">Index Name</th>
								<th className="p-3">Key Pattern</th>
								<th className="p-3">Properties</th>
								<th className="p-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/20">
							{indexes.map((idx) => {
								const isPrimary = idx.name === "_id_";
								return (
									<tr key={idx.name} className="hover:bg-white/5 transition-colors">
										<td className="p-3 font-semibold text-foreground">
											{idx.name}
											{isPrimary && (
												<Badge variant="outline" className="ml-2 text-[9px] border-orange-500/30 text-orange-400">
													primary
												</Badge>
											)}
										</td>
										<td className="p-3 text-orange-300">{JSON.stringify(idx.key)}</td>
										<td className="p-3">
											{idx.unique && (
												<Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-400 mr-1.5">
													unique
												</Badge>
											)}
											{idx.sparse && (
												<Badge variant="outline" className="text-[9px] border-border/60 text-zinc-400 mr-1.5">
													sparse
												</Badge>
											)}
											<span className="text-zinc-500 text-[10px]">v: {idx.v}</span>
										</td>
										<td className="p-3 text-right">
											{!isPrimary && (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => handleDropIndex(idx.name)}
													className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1 px-2"
												>
													<Trash2 className="h-3.5 w-3.5" /> Drop
												</Button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{/* Create Index Dialog */}
			<Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
				<DialogContent className="sm:max-w-md bg-card border-border/80 text-foreground rounded-2xl shadow-2xl">
					<form onSubmit={handleCreateIndex} className="space-y-4">
						<DialogHeader>
							<DialogTitle className="text-base font-semibold flex items-center gap-2">
								<Layers className="h-4 w-4 text-orange-400" /> Create Index
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Specify the index key pattern (1 for ascending, -1 for descending).
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-2">
							<label className="text-xs font-medium text-foreground">Key Specification (JSON)</label>
							<textarea
								value={indexKeyJson}
								onChange={(e) => setIndexKeyJson(e.target.value)}
								rows={4}
								className="w-full bg-black/50 border border-border/80 rounded-xl p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
							/>
						</div>

						<div className="flex items-center gap-2 pt-1">
							<input
								type="checkbox"
								id="unique-chk"
								checked={isUnique}
								onChange={(e) => setIsUnique(e.target.checked)}
								className="rounded border-border text-orange-500 focus:ring-orange-500 h-4 w-4"
							/>
							<label htmlFor="unique-chk" className="text-xs font-medium text-foreground">
								Unique index (enforce unique values)
							</label>
						</div>

						<DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
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
								disabled={isCreating || !indexKeyJson.trim()}
								className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium"
							>
								{isCreating ? "Creating…" : "Create Index"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
