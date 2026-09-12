import {
	Check,
	ChevronLeft,
	ChevronRight,
	Edit3,
	Filter,
	Plus,
	RefreshCw,
	SlidersHorizontal,
	Table as TableIcon,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";
import type { QueryExecResult } from "../../../types";
import { Button } from "../../ui/button";

interface DataTableViewProps {
	selectedTable: string | null;
	dataResult: QueryExecResult | null;
	isLoadingData: boolean;
	page: number;
	pageSize: number;
	onPageChange: (newPage: number) => void;
	selectedRows: number[];
	onSelectRow: (index: number, checked: boolean) => void;
	onSelectAllRows: (checked: boolean) => void;
	onSaveInlineEdit: (rowIndex: number, editedValues: Record<string, string>) => Promise<void>;
	onSaveInlineAdd: (newValues: Record<string, string>) => Promise<void>;
	onDeleteSelected: () => void;
}

function inferColumnType(colName: string, sampleValue: unknown): string {
	if (colName.toLowerCase().includes("id") || colName.toLowerCase().includes("uuid")) return "text";
	if (
		colName.toLowerCase().includes("at") ||
		colName.toLowerCase().includes("date") ||
		colName.toLowerCase().includes("time")
	)
		return "timestamp";
	if (typeof sampleValue === "number") return "numeric";
	if (typeof sampleValue === "boolean") return "boolean";
	if (typeof sampleValue === "object" && sampleValue !== null) return "json";
	return "text";
}

export function DataTableView({
	selectedTable,
	dataResult,
	isLoadingData,
	page,
	pageSize,
	onPageChange,
	selectedRows,
	onSelectRow,
	onSelectAllRows,
	onSaveInlineEdit,
	onSaveInlineAdd,
	onDeleteSelected,
}: DataTableViewProps) {
	const [isAddingInline, setIsAddingInline] = useState(false);
	const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});

	const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
	const [editingRowValues, setEditingRowValues] = useState<Record<string, string>>({});
	const [isSaving, setIsSaving] = useState(false);

	const handleStartAdd = () => {
		if (!dataResult) return;
		const init: Record<string, string> = {};
		dataResult.columns.forEach((col) => (init[col] = ""));
		setNewRowValues(init);
		setIsAddingInline(true);
	};

	const handleStartEdit = (idx: number, row: Record<string, unknown>) => {
		if (!dataResult) return;
		const init: Record<string, string> = {};
		dataResult.columns.forEach((col) => {
			const val = row[col];
			init[col] = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
		});
		setEditingRowIndex(idx);
		setEditingRowValues(init);
	};

	const handleSaveAdd = async () => {
		setIsSaving(true);
		try {
			await onSaveInlineAdd(newRowValues);
			setIsAddingInline(false);
			setNewRowValues({});
		} finally {
			setIsSaving(false);
		}
	};

	const handleSaveEdit = async (idx: number) => {
		setIsSaving(true);
		try {
			await onSaveInlineEdit(idx, editingRowValues);
			setEditingRowIndex(null);
			setEditingRowValues({});
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoadingData) {
		return (
			<div className="flex h-64 items-center justify-center border border-border/60 bg-card/60 rounded-3xl backdrop-blur-md">
				<RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
			</div>
		);
	}

	if (!dataResult || (dataResult.rows.length === 0 && !isAddingInline)) {
		return (
			<div className="border border-border/60 bg-card/60 rounded-3xl p-8 backdrop-blur-md shadow-xl flex flex-col items-center justify-center text-center space-y-4">
				<TableIcon className="h-10 w-10 text-muted-foreground/60" />
				<div>
					<h3 className="text-sm font-semibold text-foreground">No records found</h3>
					<p className="text-xs text-muted-foreground mt-1">
						Table &quot;{selectedTable || "selected"}&quot; contains 0 records on this page.
					</p>
				</div>
				<Button
					size="sm"
					onClick={handleStartAdd}
					disabled={!selectedTable}
					className="bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-xl gap-1.5"
				>
					<Plus className="h-3.5 w-3.5" /> Add First Record
				</Button>
			</div>
		);
	}

	const totalCount = dataResult.rows.length;
	const startItem = (page - 1) * pageSize + 1;
	const endItem = (page - 1) * pageSize + totalCount;

	return (
		<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-xl">
			{/* Action Toolbar above table */}
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3 font-mono text-xs">
				<div className="flex items-center gap-2 flex-wrap">
					<Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 rounded-lg border-border/60 gap-1.5">
						<Filter className="h-3 w-3 text-muted-foreground" /> Filters
					</Button>
					<Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 rounded-lg border-border/60 gap-1.5">
						<SlidersHorizontal className="h-3 w-3 text-muted-foreground" /> Columns
					</Button>

					<Button
						size="sm"
						onClick={handleStartAdd}
						disabled={isAddingInline}
						className="h-7 bg-orange-500 hover:bg-orange-600 text-white font-medium text-[11px] px-3 rounded-lg shadow-sm gap-1"
					>
						<Plus className="h-3.5 w-3.5" /> Add record
					</Button>

					{selectedRows.length > 0 && (
						<Button
							size="sm"
							variant="ghost"
							onClick={onDeleteSelected}
							className="h-7 text-red-400 hover:bg-red-500/10 text-[11px] px-2.5 rounded-lg gap-1"
						>
							<Trash2 className="h-3.5 w-3.5" /> Delete ({selectedRows.length})
						</Button>
					)}
				</div>

				{/* Right side stats & pagination */}
				<div className="flex items-center gap-3">
					<span className="text-[11px] text-muted-foreground">
						{dataResult.executionTimeMs}ms &bull; {startItem} - {endItem}
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => onPageChange(page - 1)}
							className="h-7 w-7 p-0 rounded-lg border-border/60"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={dataResult.rows.length < pageSize}
							onClick={() => onPageChange(page + 1)}
							className="h-7 w-7 p-0 rounded-lg border-border/60"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Data Grid */}
			<div className="overflow-x-auto rounded-2xl border border-border/40 bg-black/20">
				<table className="w-full text-left font-mono text-xs border-collapse">
					<thead className="bg-black/50 text-muted-foreground border-b border-border/40">
						<tr>
							<th className="p-3 w-10 text-center">
								<input
									type="checkbox"
									checked={selectedRows.length === dataResult.rows.length && dataResult.rows.length > 0}
									onChange={(e) => onSelectAllRows(e.target.checked)}
									className="h-3.5 w-3.5 accent-orange-500 rounded"
								/>
							</th>
							{dataResult.columns.map((col) => {
								const sampleVal = dataResult.rows[0]?.[col];
								const typeTag = inferColumnType(col, sampleVal);
								return (
									<th key={col} className="p-3 font-medium text-foreground whitespace-nowrap">
										<div className="flex items-center gap-1.5">
											<span>{col}</span>
											<span className="text-[9px] text-muted-foreground font-normal lowercase">{typeTag}</span>
										</div>
									</th>
								);
							})}
							<th className="p-3 text-right">Actions</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border/20">
						{/* Inline Adding Row */}
						{isAddingInline && (
							<tr className="bg-orange-500/15 border-b border-orange-500/40">
								<td className="p-2 text-center text-[10px] font-bold text-orange-400">NEW</td>
								{dataResult.columns.map((col) => (
									<td key={col} className="p-2">
										<input
											type="text"
											value={newRowValues[col] || ""}
											onChange={(e) => setNewRowValues({ ...newRowValues, [col]: e.target.value })}
											placeholder={`enter ${col}...`}
											className="w-full bg-black/80 border border-orange-500/60 focus:border-orange-400 text-xs font-mono text-orange-300 px-2.5 py-1 rounded-lg focus:outline-none"
										/>
									</td>
								))}
								<td className="p-2 text-right whitespace-nowrap">
									<div className="flex items-center justify-end gap-1">
										<Button
											size="sm"
											onClick={handleSaveAdd}
											disabled={isSaving}
											className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg gap-1"
										>
											<Check className="h-3.5 w-3.5" /> Save
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => {
												setIsAddingInline(false);
												setNewRowValues({});
											}}
											className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
										>
											<X className="h-3.5 w-3.5" />
										</Button>
									</div>
								</td>
							</tr>
						)}

						{/* Existing Rows */}
						{dataResult.rows.map((row, idx) => {
							const isSelected = selectedRows.includes(idx);
							const isEditing = editingRowIndex === idx;

							if (isEditing) {
								return (
									<tr key={idx} className="bg-orange-500/15 border-b border-orange-500/40">
										<td className="p-2 text-center">
											<input type="checkbox" checked={isSelected} disabled className="h-3.5 w-3.5 opacity-50" />
										</td>
										{dataResult.columns.map((col) => (
											<td key={col} className="p-2">
												<input
													type="text"
													value={editingRowValues[col] ?? ""}
													onChange={(e) => setEditingRowValues({ ...editingRowValues, [col]: e.target.value })}
													className="w-full bg-black/80 border border-orange-500/60 focus:border-orange-400 text-xs font-mono text-orange-300 px-2.5 py-1 rounded-lg focus:outline-none"
												/>
											</td>
										))}
										<td className="p-2 text-right whitespace-nowrap">
											<div className="flex items-center justify-end gap-1">
												<Button
													size="sm"
													onClick={() => handleSaveEdit(idx)}
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
								<tr
									key={idx}
									onDoubleClick={() => handleStartEdit(idx, row)}
									className={`hover:bg-orange-500/5 transition-all ${isSelected ? "bg-orange-500/10" : ""}`}
								>
									<td className="p-3 text-center">
										<input
											type="checkbox"
											checked={isSelected}
											onChange={(e) => onSelectRow(idx, e.target.checked)}
											className="h-3.5 w-3.5 accent-orange-500 rounded"
										/>
									</td>
									{dataResult.columns.map((col) => (
										<td key={col} className="p-3 text-foreground max-w-xs truncate">
											{row[col] === null ? (
												<span className="text-muted-foreground italic text-[10px] uppercase">NULL</span>
											) : typeof row[col] === "object" ? (
												JSON.stringify(row[col])
											) : (
												String(row[col])
											)}
										</td>
									))}
									<td className="p-3 text-right whitespace-nowrap">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleStartEdit(idx, row)}
											className="h-7 px-2 text-xs text-orange-400 hover:bg-orange-500/10 rounded-lg gap-1"
										>
											<Edit3 className="h-3.5 w-3.5" /> Edit
										</Button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
