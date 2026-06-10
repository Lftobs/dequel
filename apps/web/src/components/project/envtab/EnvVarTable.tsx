import { Button } from "../../ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Plus, Upload } from "lucide-react";
import { EnvVarRow } from "./EnvVarRow";

interface EnvVar {
	id: string;
	key: string;
	value: string | null;
	environment: string;
}

interface EnvVarTableProps {
	envVars: EnvVar[];
	editingId: string | null;
	editingValue: string;
	savingEdit: Record<string, boolean>;
	revealValues: Record<string, string>;
	revealing: Record<string, boolean>;
	copiedId: string | null;
	onAdd: () => void;
	onImport: () => void;
	onDelete: (id: string) => void;
	onStartEdit: (id: string) => void;
	onCancelEdit: () => void;
	onSaveEdit: (id: string) => Promise<void>;
	onReveal: (id: string) => Promise<void>;
	onHide: (id: string) => void;
	onCopy: (id: string) => Promise<void>;
	onEditingValueChange: (value: string) => void;
}

export function EnvVarTable({
	envVars,
	editingId,
	editingValue,
	savingEdit,
	revealValues,
	revealing,
	copiedId,
	onAdd,
	onImport,
	onDelete,
	onStartEdit,
	onCancelEdit,
	onSaveEdit,
	onReveal,
	onHide,
	onCopy,
	onEditingValueChange,
}: EnvVarTableProps) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-foreground">
						Environment Variables
					</h2>
					<p className="text-sm text-muted-foreground">
						Secure, encrypted settings injected into deployments.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={onImport}
						className="border-border hover:bg-secondary/50 text-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs"
					>
						<Upload className="h-4 w-4" /> Import
					</Button>
					<Button
						onClick={onAdd}
						className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs shadow-md"
					>
						<Plus className="h-4.5 w-4.5" /> Add Variable
					</Button>
				</div>
			</div>

			<div className="rounded-xl border border-border bg-card/35 backdrop-blur-sm overflow-hidden">
				<Table>
					<TableHeader className="bg-[#0b0b0f]/50">
						<TableRow className="border-border hover:bg-transparent">
							<TableHead className="text-xs font-semibold py-3">
								Key
							</TableHead>
							<TableHead className="text-xs font-semibold py-3">
								Value
							</TableHead>
							<TableHead className="text-xs font-semibold py-3">
								Environment
							</TableHead>
							<TableHead className="w-32 text-right pr-6"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{envVars.map((ev) => (
							<EnvVarRow
								key={ev.id}
								variable={ev}
								revealed={revealValues[ev.id]}
								revealing={!!revealing[ev.id]}
								editing={editingId === ev.id}
								editingValue={editingValue}
								saving={!!savingEdit[ev.id]}
								copied={copiedId === ev.id}
								projectId=""
								onDelete={onDelete}
								onStartEdit={onStartEdit}
								onCancelEdit={onCancelEdit}
								onSaveEdit={onSaveEdit}
								onReveal={onReveal}
								onHide={onHide}
								onCopy={onCopy}
								onEditingValueChange={onEditingValueChange}
							/>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
