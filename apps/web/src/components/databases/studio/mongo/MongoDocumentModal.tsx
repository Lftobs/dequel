import { Braces, Check, Copy, FileJson } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/dialog";

interface MongoDocumentModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	documentToEdit: Record<string, unknown> | null;
	collectionName: string;
	onSave: (doc: Record<string, unknown>) => Promise<void>;
}

export function MongoDocumentModal({
	open,
	onOpenChange,
	documentToEdit,
	collectionName,
	onSave,
}: MongoDocumentModalProps) {
	const isEdit = !!documentToEdit;
	const [jsonText, setJsonText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (open) {
			setError(null);
			if (documentToEdit) {
				setJsonText(JSON.stringify(documentToEdit, null, 2));
			} else {
				setJsonText("{\n  \n}");
			}
		}
	}, [open, documentToEdit]);

	const handleFormat = () => {
		try {
			const parsed = JSON.parse(jsonText);
			setJsonText(JSON.stringify(parsed, null, 2));
			setError(null);
		} catch (err: any) {
			setError(`Invalid JSON: ${err.message}`);
		}
	};

	const handleSave = async () => {
		setError(null);
		let parsed: any;
		try {
			parsed = JSON.parse(jsonText);
		} catch (err: any) {
			setError(`Invalid JSON: ${err.message}`);
			return;
		}

		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			setError("Document must be a valid JSON object");
			return;
		}

		setIsSaving(true);
		try {
			await onSave(parsed);
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Failed to save document");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl bg-card border-border/80 text-foreground rounded-2xl shadow-2xl">
				<DialogHeader className="border-b border-border/40 pb-3">
					<div className="flex items-center justify-between">
						<DialogTitle className="text-base font-semibold flex items-center gap-2">
							<FileJson className="h-4 w-4 text-emerald-400" />
							{isEdit ? "Edit Document" : "Insert Document"} —{" "}
							<span className="font-mono text-emerald-300">{collectionName}</span>
						</DialogTitle>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleFormat}
							className="h-7 text-xs border-border/60 gap-1.5"
						>
							<Braces className="h-3 w-3 text-orange-400" /> Format JSON
						</Button>
					</div>
					<DialogDescription className="text-xs text-muted-foreground">
						{isEdit
							? "Modify the document fields. Changes will replace the existing document."
							: "Enter the document as a valid JSON object. A unique _id will be generated if omitted."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 py-2">
					<textarea
						value={jsonText}
						onChange={(e) => setJsonText(e.target.value)}
						rows={14}
						placeholder='{\n  "name": "Example",\n  "status": "active"\n}'
						className="w-full bg-black/50 border border-border/80 rounded-xl p-4 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-y"
					/>

					{error && <p className="text-xs text-red-400 font-mono">{error}</p>}
				</div>

				<DialogFooter className="gap-2 sm:gap-0 border-t border-border/40 pt-3">
					<Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={handleSave}
						disabled={isSaving || !jsonText.trim()}
						className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
					>
						{isSaving ? "Saving…" : isEdit ? "Save Changes" : "Insert Document"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
