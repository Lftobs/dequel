import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/dialog";
import { Input } from "../../../ui/input";

interface RedisRenameDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentKey: string;
	onRename: (newKey: string) => Promise<void>;
}

export function RedisRenameDialog({ open, onOpenChange, currentKey, onRename }: RedisRenameDialogProps) {
	const [name, setName] = useState(currentKey);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		setName(currentKey);
	}, [currentKey, open]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || trimmed === currentKey) return;
		setIsSubmitting(true);
		try {
			await onRename(trimmed);
			onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm bg-card border-border/80 text-foreground rounded-2xl shadow-2xl">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle className="text-sm font-semibold">Rename Redis Key</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Enter the new key name for <span className="font-mono text-foreground font-semibold">{currentKey}</span>
						</DialogDescription>
					</DialogHeader>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="font-mono text-xs bg-black/50 border-border/80"
						autoFocus
					/>
					<DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
						<Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
							Cancel
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={isSubmitting || !name.trim() || name.trim() === currentKey}
							className="text-xs bg-orange-500 hover:bg-orange-600 text-white"
						>
							{isSubmitting ? "Renaming…" : "Rename"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

interface RedisTtlDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentTtl: number | null;
	onUpdateTtl: (ttlSeconds: number | null) => Promise<void>;
}

export function RedisTtlDialog({ open, onOpenChange, currentTtl, onUpdateTtl }: RedisTtlDialogProps) {
	const [val, setVal] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		setVal(currentTtl && currentTtl > 0 ? String(currentTtl) : "");
	}, [currentTtl, open]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			const num = val.trim() ? Number(val.trim()) : null;
			await onUpdateTtl(num);
			onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm bg-card border-border/80 text-foreground rounded-2xl shadow-2xl">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle className="text-sm font-semibold flex items-center gap-2">
							<Clock className="h-4 w-4 text-amber-400" /> Manage TTL Expiration
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Enter expiration in seconds, or leave empty/0 to make key persistent.
						</DialogDescription>
					</DialogHeader>
					<Input
						type="number"
						placeholder="Seconds (leave empty to persist)"
						value={val}
						onChange={(e) => setVal(e.target.value)}
						className="font-mono text-xs bg-black/50 border-border/80"
						autoFocus
					/>
					<DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
						<Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
							Cancel
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={isSubmitting}
							className="text-xs bg-orange-500 hover:bg-orange-600 text-white"
						>
							{isSubmitting ? "Updating…" : "Update TTL"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
