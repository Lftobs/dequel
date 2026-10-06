import {
	Braces,
	ChevronLeft,
	ChevronRight,
	Database,
	FileJson,
	Filter,
	Plus,
	RefreshCw,
	SlidersHorizontal,
	Table as TableIcon,
} from "lucide-react";
import { useState } from "react";
import type { QueryExecResult } from "../../../../types";
import { Button } from "../../../ui/button";
import { MongoDocumentCard } from "./MongoDocumentCard";
import { MongoDocumentModal } from "./MongoDocumentModal";
import { MongoDocumentsTableView } from "./MongoDocumentsTableView";

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
	const [viewMode, setViewMode] = useState<"json" | "table">("table");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingDoc, setEditingDoc] = useState<Record<string, unknown> | null>(null);
	const [isAddingInline, setIsAddingInline] = useState(false);

	const docs = dataResult?.rows ?? [];
	const columns = dataResult?.columns ?? [];

	const handleStartAdd = () => {
		if (columns.length === 0 || viewMode === "json") {
			setEditingDoc(null);
			setIsModalOpen(true);
			return;
		}
		setIsAddingInline(true);
	};

	const handleOpenInsertModal = () => {
		setEditingDoc(null);
		setIsModalOpen(true);
	};

	const handleOpenEditModal = (doc: Record<string, unknown>) => {
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
				<RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
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
							onClick={() => setViewMode("table")}
							className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
								viewMode === "table"
									? "bg-orange-500 text-white shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<TableIcon className="h-3.5 w-3.5" /> Table View
						</button>
						<button
							type="button"
							onClick={() => setViewMode("json")}
							className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
								viewMode === "json"
									? "bg-orange-500 text-white shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<FileJson className="h-3.5 w-3.5" /> JSON Cards
						</button>
					</div>

					<div className="flex items-center gap-2">
						{viewMode === "table" && (
							<Button
								size="sm"
								onClick={handleStartAdd}
								disabled={!selectedCollection || isAddingInline}
								className="bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-xl gap-1.5 shadow-md"
							>
								<Plus className="h-3.5 w-3.5" /> Add Document
							</Button>
						)}
						<Button
							size="sm"
							variant="outline"
							onClick={handleOpenInsertModal}
							disabled={!selectedCollection}
							className="border-border/60 text-xs rounded-xl gap-1.5"
						>
							<Braces className="h-3.5 w-3.5 text-orange-400" /> JSON Insert
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
			{docs.length === 0 && !isAddingInline ? (
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
						onClick={handleStartAdd}
						className="bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-xl gap-1.5 mt-2"
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
							onEdit={handleOpenEditModal}
							onDelete={onDeleteDocument}
						/>
					))}
				</div>
			) : (
				<MongoDocumentsTableView
					docs={docs}
					columns={columns}
					onInsertDocument={onInsertDocument}
					onUpdateDocument={onUpdateDocument}
					onDeleteDocument={onDeleteDocument}
					onOpenEditModal={handleOpenEditModal}
					isAddingInline={isAddingInline}
					onCancelAddInline={() => setIsAddingInline(false)}
				/>
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
