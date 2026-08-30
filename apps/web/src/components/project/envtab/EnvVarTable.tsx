import { Button } from "../../ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Plus, Upload, Lock, Pencil, Eye, EyeOff, Copy, Check, Trash2 } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
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
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold text-foreground">
						Environment Variables
					</h2>
					<p className="text-sm text-muted-foreground">
						Secure, encrypted settings injected into deployments.
					</p>
				</div>
				<div className="flex items-center gap-2 w-full sm:w-auto">
					<Button
						variant="outline"
						onClick={onImport}
						className="border-border hover:bg-secondary/50 text-foreground font-semibold flex items-center justify-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs flex-1 sm:flex-none"
					>
						<Upload className="h-4 w-4" /> Import
					</Button>
					<Button
						onClick={onAdd}
						className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs shadow-md flex-1 sm:flex-none"
					>
						<Plus className="h-4.5 w-4.5" /> Add Variable
					</Button>
				</div>
			</div>

			<div className="rounded-xl border border-border bg-card/35 backdrop-blur-sm overflow-hidden">
				{/* Mobile Card List View (< md) */}
				<div className="md:hidden divide-y divide-border">
					{envVars.map((ev) => {
						const isEditing = editingId === ev.id;
						const isRevealed = revealValues[ev.id];
						const isRevealing = !!revealing[ev.id];
						const isSaving = !!savingEdit[ev.id];
						const isCopied = copiedId === ev.id;

						return (
							<div key={ev.id} className="p-3.5 space-y-3">
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<Lock className="h-3.5 w-3.5 text-primary opacity-60 shrink-0" />
										<span className="font-mono text-sm font-semibold text-foreground truncate">
											{ev.key}
										</span>
									</div>
									<Badge
										variant="outline"
										className="text-[10px] uppercase border-primary/20 text-primary bg-primary/5 px-2 py-0.5 shrink-0"
									>
										{ev.environment || "all"}
									</Badge>
								</div>

								<div className="font-mono text-xs text-muted-foreground bg-black/20 p-2.5 rounded-lg border border-border/40 min-h-[38px] flex items-center">
									{isEditing ? (
										<Input
											value={editingValue}
											onChange={(e) => onEditingValueChange(e.target.value)}
											className="h-8 bg-[#09090c] border-input text-xs font-mono w-full"
											autoFocus
										/>
									) : (
										<span className={isRevealed ? "text-foreground font-semibold break-all" : "opacity-45"}>
											{isRevealed ?? "••••••••"}
										</span>
									)}
								</div>

								<div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
									<div className="flex items-center gap-1.5">
										{isEditing ? (
											<>
												<Button
													size="sm"
													onClick={() => onSaveEdit(ev.id)}
													disabled={isSaving}
													className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-[10px] px-3 font-semibold rounded-md"
												>
													Save
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={onCancelEdit}
													className="h-7 text-[10px] px-2 rounded-md"
												>
													Cancel
												</Button>
											</>
										) : (
											<>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-foreground"
													onClick={() => onStartEdit(ev.id)}
													title="Edit value"
												>
													<Pencil className="h-3.5 w-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-foreground"
													onClick={() => isRevealed ? onHide(ev.id) : onReveal(ev.id)}
													title={isRevealed ? "Hide value" : "Reveal value"}
													disabled={isRevealing}
												>
													{isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className={`h-8 w-8 ${isCopied ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground hover:text-foreground"}`}
													onClick={() => onCopy(ev.id)}
													title="Copy value"
													disabled={isRevealing}
												>
													{isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
												</Button>
											</>
										)}
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
										onClick={() => onDelete(ev.id)}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						);
					})}
				</div>

				{/* Desktop Table View (>= md) */}
				<div className="hidden md:block overflow-x-auto">
					<Table className="w-full">
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
		</div>
	);
}
