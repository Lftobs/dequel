import { Button } from "../../ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../../ui/dialog";

interface DeleteEnvVarDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
}

export function DeleteEnvVarDialog({
	open,
	onOpenChange,
	onConfirm,
}: DeleteEnvVarDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
				<DialogHeader>
					<DialogTitle className="text-lg font-bold text-foreground">
						Delete Variable
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground mt-2">
						Are you sure you want to delete this environment variable?
						Your application may need to be redeployed for changes to
						take effect.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
					>
						Cancel
					</Button>
					<Button
						onClick={onConfirm}
						className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all"
					>
						Delete Variable
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
