import { Check, Copy, Edit3, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";

interface MongoDocumentCardProps {
	doc: Record<string, unknown>;
	index: number;
	onEdit: (doc: Record<string, unknown>) => void;
	onDelete: (id: string) => void;
}

export function MongoDocumentCard({ doc, index, onEdit, onDelete }: MongoDocumentCardProps) {
	const [copied, setCopied] = useState(false);
	const docId = String(doc._id ?? doc.id ?? `doc-${index}`);
	const jsonString = JSON.stringify(doc, null, 2);

	const handleCopy = () => {
		navigator.clipboard.writeText(jsonString);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const renderValue = (val: unknown): React.ReactNode => {
		if (val === null) return <span className="text-zinc-500">null</span>;
		if (val === undefined) return <span className="text-zinc-600">undefined</span>;
		if (typeof val === "boolean") return <span className="text-purple-400 font-semibold">{String(val)}</span>;
		if (typeof val === "number") return <span className="text-amber-400">{val}</span>;
		if (typeof val === "string") return <span className="text-emerald-400">&quot;{val}&quot;</span>;
		if (Array.isArray(val)) {
			return (
				<span className="text-zinc-300">
					[
					{val.map((item, i) => (
						<span key={i}>
							{i > 0 && ", "}
							{renderValue(item)}
						</span>
					))}
					]
				</span>
			);
		}
		if (typeof val === "object") {
			const entries = Object.entries(val as Record<string, unknown>);
			return (
				<span className="text-zinc-300">
					{"{"}
					<span className="pl-3 block border-l border-zinc-800 my-0.5">
						{entries.map(([k, v], i) => (
							<span key={k} className="block">
								<span className="text-orange-300 font-medium">&quot;{k}&quot;</span>: {renderValue(v)}
								{i < entries.length - 1 && ","}
							</span>
						))}
					</span>
					{"}"}
				</span>
			);
		}
		return <span className="text-zinc-300">{String(val)}</span>;
	};

	return (
		<div className="rounded-2xl border border-border/70 bg-black/40 backdrop-blur-sm overflow-hidden shadow-md hover:border-emerald-500/30 transition-all">
			<div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-zinc-900/60 font-mono text-xs">
				<div className="flex items-center gap-2">
					<Badge
						variant="outline"
						className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5"
					>
						_id: {docId}
					</Badge>
					<span className="text-[11px] text-muted-foreground">
						{Object.keys(doc).length} {Object.keys(doc).length === 1 ? "field" : "fields"}
					</span>
				</div>

				<div className="flex items-center gap-1.5">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleCopy}
						className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
						title="Copy Document JSON"
					>
						{copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
						<span className="text-[10px] hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onEdit(doc)}
						className="h-7 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1 px-2"
					>
						<Edit3 className="h-3 w-3" />
						<span className="text-[10px] hidden sm:inline">Edit</span>
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onDelete(docId)}
						className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1 px-2"
					>
						<Trash2 className="h-3 w-3" />
					</Button>
				</div>
			</div>

			<div className="p-4 font-mono text-xs leading-relaxed max-h-72 overflow-y-auto overflow-x-auto text-foreground">
				{"{"}
				<div className="pl-4 border-l border-zinc-800 my-1 space-y-1">
					{Object.entries(doc).map(([k, v], i, arr) => (
						<div key={k} className="flex items-start gap-1">
							<span className="text-orange-400 shrink-0 font-medium">&quot;{k}&quot;:</span>
							<div className="flex-1 overflow-x-auto">
								{renderValue(v)}
								{i < arr.length - 1 ? "," : ""}
							</div>
						</div>
					))}
				</div>
				{"}"}
			</div>
		</div>
	);
}
