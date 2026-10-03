import {
	ChevronLeft,
	ChevronRight,
	Database,
	Edit3,
	FileJson,
	Filter,
	Layers,
	Plus,
	RefreshCw,
	SlidersHorizontal,
	Table as TableIcon,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import type { QueryExecResult } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { MongoDocumentCard } from "./MongoDocumentCard";
import { MongoDocumentModal } from "./MongoDocumentModal";

interface MongoDocumentsViewProps {
	selectedCollection: string | null;
	dataResult: QueryExecResult | null;
	isLoading: boolean;
	page: number;
	pageSize: number;
	onPageChange: (newPage: number) => void;
	onPageSizeChange: (newSize: number) => void;
	filterJson: string;
	onFilterChange: (val: string) => void;
	sortJson: string;
	onSortChange: (val: string) => void;
	onApplyFilter: () => void;
	onInsertDocument: (doc: Record<string, unknown>) => Promise<void>;
	onUpdateDocument: (doc: Record<string, unknown>) => Promise<void>;
	onDeleteDocument: (id: string) => Promise<void>;
}

export function MongoDocumentsView({
	selectedCollection,
	dataResult,
	isLoading,
	page,
	pageSize,
	onPageChange,
	onPageSizeChange,
	filterJson,
	onFilterChange,
	sortJson,
	onSortChange,
	onApplyFilter,
	onInsertDocument,
	onUpdateDocument,
	onDeleteDocument,
}: MongoDocumentsViewProps) {
	const [viewMode, setViewMode] = useState<"json" | "table">("json");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingDoc, setEditingDoc] = useState<Record<string, unknown> | null>(null);

	const docs = dataResult?.rows ?? [];
	const columns = dataResult?.columns ?? [];

	const handleOpenInsert = () => {
		setEditingDoc(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (doc: Record<string, unknown>) => {
		setEditingDoc(doc);
		setIsModalOpen(true);
	};

	const handleSaveDocument = async (doc: Record<string, unknown>) => {
		if (editingDoc) {
			await onUpdateDocument(doc);
		} else {
			await onInsertDocument(doc);
		}
	};

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center border border-border/60 bg-card/60 rounded-3xl backdrop-blur-md">
				<RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
			</div>
		);
	}

	return (
		<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-xl">
			{/* Top Query & Filter Toolbar */}
			<div className="flex flex-col gap-3 border-b border-border/40 pb-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-border/40">
						<button
							type="button"
							onClick={() => setViewMode("json")}
							className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
								viewMode === "json"
									? "bg-emerald-600 text-white shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<FileJson className="h-3.5 w-3.5" /> JSON Cards
						</button>
						<button
							type="button"
							onClick={() => setViewMode("table")}
							className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
								viewMode === "table"
									? "bg-emerald-600 text-white shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<TableIcon className="h-3.5 w-3.5" /> Table View
						</button>
					</div>

					<div className="flex items-center gap-2">
						<Button
							size="sm"
							onClick={handleOpenInsert}
							disabled={!selectedCollection}
							className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl gap-1.5 shadow-md"
						>
							<Plus className="h-3.5 w-3.5" /> Insert Document
						</Button>
					</div>
				</div>

				{/* Filter & Sort Inputs */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						onApplyFilter();
					}}
					className="grid grid-cols-1 sm:grid-cols-3 gap-2"
				>
					<div className="sm:col-span-2 flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-xl border border-border/40">
						<Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
						<input
							type="text"
							value={filterJson}
							onChange={(e) => onFilterChange(e.target.value)}
							placeholder='Filter: e.g. { "status": "active" }'
							className="w-full bg-transparent font-mono text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/60"
						/>
					</div>

					<div className="flex items-center gap-2">
						<div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-xl border border-border/40">
							<SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
							<input
								type="text"
								value={sortJson}
								onChange={(e) => onSortChange(e.target.value)}
								placeholder='Sort: { "_id": -1 }'
								className="w-full bg-transparent font-mono text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/60"
							/>
						</div>
						<Button type="submit" size="sm" variant="outline" className="text-xs h-8 border-border/60">
							Find
						</Button>
					</div>
				</form>
			</div>

			{/* Documents List */}
			{docs.length === 0 ? (
				<div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
					<Database className="h-10 w-10 text-muted-foreground/40" />
					<div className="space-y-1">
						<p className="text-sm font-semibold text-foreground">No documents found</p>
						<p className="text-xs text-muted-foreground">
							Collection &quot;{selectedCollection || "selected"}&quot; has no documents matching the query filter.
						</p>
					</div>
					<Button
						size="sm"
						onClick={handleOpenInsert}
						className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl gap-1.5 mt-2"
					>
						<Plus className="h-3.5 w-3.5" /> Insert First Document
					</Button>
				</div>
			) : viewMode === "json" ? (
				<div className="space-y-3">
					{docs.map((doc, idx) => (
						<MongoDocumentCard
							key={String(doc._id ?? doc.id ?? idx)}
							doc={doc}
							index={idx}
							onEdit={handleOpenEdit}
							onDelete={onDeleteDocument}
						/>
					))}
				</div>
			) : (
				/* Table View */
				<div className="overflow-x-auto rounded-2xl border border-border/50 bg-black/30 font-mono text-xs">
					<table className="w-full text-left border-collapse">
						<thead className="bg-zinc-900/80 text-muted-foreground border-b border-border/50">
							<tr>
								{columns.map((col) => (
									<th key={col} className="p-3 font-semibold text-foreground whitespace-nowrap">
										{col}
									</th>
								))}
								<th className="p-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/20">
							{docs.map((doc, idx) => {
								const docId = String(doc._id ?? doc.id ?? idx);
								return (
									<tr key={docId} className="hover:bg-white/5 transition-colors">
										{columns.map((col) => {
											const val = doc[col];
											const isObject = typeof val === "object" && val !== null;
											return (
												<td key={col} className="p-3 max-w-xs truncate">
													{isObject ? (
														<Badge
															variant="outline"
															className="text-[10px] border-border/60 bg-card font-mono truncate max-w-full"
														>
															{JSON.stringify(val)}
														</Badge>
													) : val === null || val === undefined ? (
														<span className="text-zinc-600">null</span>
													) : typeof val === "boolean" ? (
														<span className="text-purple-400">{String(val)}</span>
													) : typeof val === "number" ? (
														<span className="text-amber-400">{val}</span>
													) : (
														<span className="text-zinc-200">{String(val)}</span>
													)}
												</td>
											);
										})}
										<td className="p-3 text-right whitespace-nowrap">
											<div className="flex items-center justify-end gap-1">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => handleOpenEdit(doc)}
													className="h-7 w-7 p-0 text-orange-400 hover:text-orange-300"
												>
													<Edit3 className="h-3 w-3" />
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => onDeleteDocument(docId)}
													className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{/* Pagination Footer */}
			{docs.length > 0 && (
				<div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 font-mono text-xs text-muted-foreground">
					<div className="flex items-center gap-2">
						<span>Page {page}</span>
						<span>•</span>
						<span>{docs.length} documents on page</span>
					</div>

					<div className="flex items-center gap-2">
						<select
							value={pageSize}
							onChange={(e) => onPageSizeChange(Number(e.target.value))}
							className="bg-black/40 border border-border/60 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none"
						>
							<option value={10}>10 per page</option>
							<option value={25}>25 per page</option>
							<option value={50}>50 per page</option>
						</select>

						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onPageChange(Math.max(1, page - 1))}
							disabled={page <= 1}
							className="h-7 w-7 p-0 border-border/60"
						>
							<ChevronLeft className="h-3.5 w-3.5" />
						</Button>

						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onPageChange(page + 1)}
							disabled={docs.length < pageSize}
							className="h-7 w-7 p-0 border-border/60"
						>
							<ChevronRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			)}

			{/* Document Modal */}
			<MongoDocumentModal
				open={isModalOpen}
				onOpenChange={setIsModalOpen}
				documentToEdit={editingDoc}
				collectionName={selectedCollection || "collection"}
				onSave={handleSaveDocument}
			/>
		</div>
	);
}
