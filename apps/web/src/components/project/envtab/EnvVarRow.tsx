import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import {
	Lock,
	Pencil,
	Eye,
	EyeOff,
	Copy,
	Check,
	Trash2,
} from "lucide-react";
import * as api from "../../../api/client";

interface EnvVar {
	id: string;
	key: string;
	value: string | null;
	environment: string;
}

interface EnvVarRowProps {
	variable: EnvVar;
	revealed: string | undefined;
	revealing: boolean;
	editing: boolean;
	editingValue: string;
	saving: boolean;
	copied: boolean;
	projectId: string;
	onDelete: (id: string) => void;
	onStartEdit: (id: string) => void;
	onCancelEdit: () => void;
	onSaveEdit: (id: string) => Promise<void>;
	onReveal: (id: string) => Promise<void>;
	onHide: (id: string) => void;
	onCopy: (id: string) => Promise<void>;
	onEditingValueChange: (value: string) => void;
}

export function EnvVarRow({
	variable: ev,
	revealed,
	revealing,
	editing,
	editingValue,
	saving,
	copied,
	onDelete,
	onStartEdit,
	onCancelEdit,
	onSaveEdit,
	onReveal,
	onHide,
	onCopy,
	onEditingValueChange,
}: EnvVarRowProps) {
	return (
		<tr className="border-border hover:bg-[#121217]/30 group transition-all">
			<td className="font-mono text-sm py-3.5 font-semibold text-foreground flex items-center gap-2 px-4">
				<Lock className="h-3.5 w-3.5 text-primary opacity-60 shrink-0" />
				{ev.key}
			</td>
			<td className="font-mono text-xs py-3.5 text-muted-foreground px-4">
				{editing ? (
					<Input
						value={editingValue}
						onChange={(e) =>
							onEditingValueChange(e.target.value)
						}
						className="h-8 bg-[#09090c] border-input text-xs font-mono"
					/>
				) : (
					<span
						className={
							revealed
								? "text-foreground font-semibold"
								: "opacity-45"
						}
					>
						{revealed ?? "••••••••"}
					</span>
				)}
			</td>
			<td className="py-3.5 px-4">
				{ev.environment ? (
					<Badge
						variant="outline"
						className="text-[10px] uppercase border-primary/20 text-primary bg-primary/5 px-2 py-0.5"
					>
						{ev.environment}
					</Badge>
				) : (
					<span className="text-muted-foreground/60 text-xs">
						all (default)
					</span>
				)}
			</td>
			<td className="py-3.5 pr-6 text-right">
				<div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
					{editing ? (
						<>
							<Button
								size="sm"
								onClick={() => onSaveEdit(ev.id)}
								disabled={saving}
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
								className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-md transition-all"
								onClick={() => onStartEdit(ev.id)}
								title="Edit value"
								disabled={saving}
							>
								<Pencil className="h-3.5 w-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-md transition-all"
								onClick={() =>
									revealed ? onHide(ev.id) : onReveal(ev.id)
								}
								title={
									revealed ? "Hide value" : "Reveal value"
								}
								disabled={revealing}
							>
								{revealed ? (
									<EyeOff className="h-3.5 w-3.5" />
								) : (
									<Eye className="h-3.5 w-3.5" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className={`h-7 w-7 rounded-md transition-all ${
									copied
										? "text-emerald-400 bg-emerald-500/10"
										: "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
								}`}
								onClick={() => onCopy(ev.id)}
								title="Copy value"
								disabled={revealing}
							>
								{copied ? (
									<Check className="h-3.5 w-3.5" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
							</Button>
						</>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
						onClick={() => onDelete(ev.id)}
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			</td>
		</tr>
	);
}
