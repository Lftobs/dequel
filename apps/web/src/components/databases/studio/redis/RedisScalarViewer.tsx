import { Edit2, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";

interface RedisStringViewerProps {
	value: string;
	onSave: (newValue: string) => Promise<void>;
}

export function RedisStringViewer({ value, onSave }: RedisStringViewerProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const [isJsonView, setIsJsonView] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const isValueJson = () => {
		if (!value || value.length < 2) return false;
		try {
			JSON.parse(value);
			return true;
		} catch {
			return false;
		}
	};

	const formattedDisplay = () => {
		if (!isJsonView) return value;
		try {
			return JSON.stringify(JSON.parse(value), null, 2);
		} catch {
			return value;
		}
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await onSave(draft);
			setIsEditing(false);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground font-mono">Length: {value.length} characters</span>
				<div className="flex items-center gap-2">
					{isValueJson() && !isEditing && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsJsonView(!isJsonView)}
							className="h-7 text-xs bg-black/40 border-border/60"
						>
							{isJsonView ? "View Raw" : "Format JSON"}
						</Button>
					)}
					{isEditing ? (
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setDraft(value);
									setIsEditing(false);
								}}
								className="h-7 text-xs"
							>
								<X className="h-3 w-3 mr-1" /> Cancel
							</Button>
							<Button
								size="sm"
								onClick={handleSave}
								disabled={isSaving}
								className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
							>
								<Save className="h-3 w-3 mr-1" /> {isSaving ? "Saving…" : "Save"}
							</Button>
						</div>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setDraft(value);
								setIsEditing(true);
							}}
							className="h-7 text-xs border-border/60"
						>
							<Edit2 className="h-3 w-3 mr-1" /> Edit Value
						</Button>
					)}
				</div>
			</div>

			{isEditing ? (
				<textarea
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					rows={12}
					className="w-full bg-black/70 border border-orange-500/40 rounded-2xl p-4 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500 resize-y leading-relaxed"
					autoFocus
				/>
			) : (
				<pre className="p-4 bg-black/50 border border-border/40 rounded-2xl font-mono text-xs text-foreground/90 whitespace-pre-wrap break-all max-h-[460px] overflow-y-auto leading-relaxed">
					{formattedDisplay() || <span className="text-muted-foreground italic">(empty string)</span>}
				</pre>
			)}
		</div>
	);
}

interface RedisHashViewerProps {
	entries: { field: string; value: string }[];
	onAddField: (field: string, value: string) => Promise<void>;
	onDeleteField: (field: string) => Promise<void>;
}

export function RedisHashViewer({ entries, onAddField, onDeleteField }: RedisHashViewerProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [newField, setNewField] = useState("");
	const [newValue, setNewValue] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleAdd = async () => {
		if (!newField.trim()) return;
		setIsSubmitting(true);
		try {
			await onAddField(newField.trim(), newValue);
			setNewField("");
			setNewValue("");
			setShowAdd(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground font-mono">{entries.length} Fields</span>
				<Button
					size="sm"
					onClick={() => setShowAdd(!showAdd)}
					className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
				>
					<Plus className="h-3 w-3 mr-1" /> Add Field
				</Button>
			</div>

			{showAdd && (
				<div className="p-3 bg-black/40 border border-border/60 rounded-xl space-y-2">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
						<Input
							placeholder="Field name"
							value={newField}
							onChange={(e) => setNewField(e.target.value)}
							className="text-xs font-mono h-8 bg-black/50"
							autoFocus
						/>
						<Input
							placeholder="Field value"
							value={newValue}
							onChange={(e) => setNewValue(e.target.value)}
							className="text-xs font-mono h-8 bg-black/50"
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={handleAdd}
							disabled={isSubmitting || !newField.trim()}
							className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
						>
							Save Field
						</Button>
					</div>
				</div>
			)}

			<div className="border border-border/40 rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto">
				<table className="w-full text-xs font-mono">
					<thead className="bg-black/40 border-b border-border/40 text-muted-foreground">
						<tr>
							<th className="p-2.5 text-left font-semibold w-1/3">Field</th>
							<th className="p-2.5 text-left font-semibold">Value</th>
							<th className="p-2.5 text-right font-semibold w-16">Action</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border/20">
						{entries.length === 0 ? (
							<tr>
								<td colSpan={3} className="p-6 text-center text-muted-foreground italic">
									No fields in this hash
								</td>
							</tr>
						) : (
							entries.map((entry) => (
								<tr key={entry.field} className="hover:bg-white/5 transition-colors">
									<td className="p-2.5 font-bold text-orange-300 break-all">{entry.field}</td>
									<td className="p-2.5 text-foreground/90 break-all">{entry.value}</td>
									<td className="p-2.5 text-right">
										<button
											type="button"
											onClick={() => onDeleteField(entry.field)}
											className="text-muted-foreground hover:text-red-400 p-1 rounded transition-colors"
											title="Delete field"
										>
											<Trash2 className="h-3 w-3" />
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
