import { Braces, Check, Edit3, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";

interface MongoDocumentsTableViewProps {
	docs: Record<string, unknown>[];
	columns: string[];
	onInsertDocument: (doc: Record<string, unknown>) => Promise<void>;
	onUpdateDocument: (doc: Record<string, unknown>) => Promise<void>;
	onDeleteDocument: (id: string) => Promise<void>;
	onOpenEditModal: (doc: Record<string, unknown>) => void;
	isAddingInline: boolean;
	onCancelAddInline: () => void;
}

const parseFieldValue = (v: string): unknown => {
	const trimmed = v.trim();
	if (trimmed === "" || trimmed === "null") return null;
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (!isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);
	if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return v;
		}
	}
	return v;
};

export function MongoDocumentsTableView({
	docs,
	columns,
	onInsertDocument,
	onUpdateDocument,
	onDeleteDocument,
	onOpenEditModal,
	isAddingInline,
	onCancelAddInline,
}: MongoDocumentsTableViewProps) {
	const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});
	const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
	const [editingRowValues, setEditingRowValues] = useState<Record<string, string>>({});
	const [isSaving, setIsSaving] = useState(false);

	const handleSaveInlineAdd = async () => {
		setIsSaving(true);
		try {
			const doc: Record<string, unknown> = {};
			Object.entries(newRowValues).forEach(([k, v]) => {
				if (v !== undefined && v !== "") {
					doc[k] = parseFieldValue(v);
				}
			});
			await onInsertDocument(doc);
			setNewRowValues({});
			onCancelAddInline();
		} finally {
			setIsSaving(false);
		}
	};

	const handleStartInlineEdit = (idx: number, doc: Record<string, unknown>) => {
		const init: Record<string, string> = {};
		columns.forEach((col) => {
			const val = doc[col];
			init[col] = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
		});
		setEditingRowIndex(idx);
		setEditingRowValues(init);
	};

	const handleSaveInlineEdit = async (idx: number) => {
		setIsSaving(true);
		try {
			const originalDoc = docs[idx];
			const doc: Record<string, unknown> = { ...originalDoc };
			Object.entries(editingRowValues).forEach(([k, v]) => {
				if (k === "_id") return;
				doc[k] = parseFieldValue(v);
			});
			await onUpdateDocument(doc);
			setEditingRowIndex(null);
			setEditingRowValues({});
		} finally {
			setIsSaving(false);
		}
	};

	return (
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
					{/* Inline Adding Row */}
					{isAddingInline && (
						<tr className="bg-orange-500/15 border-b border-orange-500/40">
							{columns.map((col) => {
								if (col === "_id") {
									return (
										<td key={col} className="p-2 text-orange-400 italic text-[11px]">
											(auto generated)
										</td>
									);
								}
								return (
									<td key={col} className="p-2">
										<input
											type="text"
											value={newRowValues[col] || ""}
											onChange={(e) => setNewRowValues({ ...newRowValues, [col]: e.target.value })}
											placeholder={`enter ${col}...`}
											className="w-full bg-black/80 border border-orange-500/60 focus:border-orange-400 text-xs font-mono text-orange-300 px-2.5 py-1 rounded-lg focus:outline-none"
										/>
									</td>
								);
							})}
							<td className="p-2 text-right whitespace-nowrap">
								<div className="flex items-center justify-end gap-1">
									<Button
										size="sm"
										onClick={handleSaveInlineAdd}
										disabled={isSaving}
										className="h-7 px-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg gap-1"
									>
										<Check className="h-3.5 w-3.5" /> Save
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => {
											setNewRowValues({});
											onCancelAddInline();
										}}
										className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								</div>
							</td>
						</tr>
					)}

					{/* Document Rows */}
					{docs.map((doc, idx) => {
						const docId = String(doc._id ?? doc.id ?? idx);
						const isEditing = editingRowIndex === idx;

						if (isEditing) {
							return (
								<tr key={docId} className="bg-orange-500/15 border-b border-orange-500/40">
									{columns.map((col) => {
										if (col === "_id") {
											return (
												<td key={col} className="p-2 text-muted-foreground font-mono text-[11px] truncate max-w-xs">
													{String(doc._id)}
												</td>
											);
										}
										return (
											<td key={col} className="p-2">
												<input
													type="text"
													value={editingRowValues[col] ?? ""}
													onChange={(e) => setEditingRowValues({ ...editingRowValues, [col]: e.target.value })}
													className="w-full bg-black/80 border border-orange-500/60 focus:border-orange-400 text-xs font-mono text-orange-300 px-2.5 py-1 rounded-lg focus:outline-none"
												/>
											</td>
										);
									})}
									<td className="p-2 text-right whitespace-nowrap">
										<div className="flex items-center justify-end gap-1">
											<Button
												size="sm"
												onClick={() => handleSaveInlineEdit(idx)}
												disabled={isSaving}
												className="h-7 px-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg gap-1"
											>
												<Check className="h-3.5 w-3.5" /> Save
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => {
													setEditingRowIndex(null);
													setEditingRowValues({});
												}}
												className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
											>
												<X className="h-3.5 w-3.5" />
											</Button>
										</div>
									</td>
								</tr>
							);
						}

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
											onClick={() => handleStartInlineEdit(idx, doc)}
											className="h-7 w-7 p-0 text-orange-400 hover:text-orange-300"
											title="Inline Edit"
										>
											<Edit3 className="h-3 w-3" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => onOpenEditModal(doc)}
											className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
											title="Edit Full JSON"
										>
											<Braces className="h-3 w-3" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => onDeleteDocument(docId)}
											className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
											title="Delete Document"
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
	);
}
