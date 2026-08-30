import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../ui/dialog";
import { Button } from "../../ui/button";

interface DeleteDomainDialogProps {
	domain: string | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
}

export function DeleteDomainDialog({
	domain,
	open,
	onOpenChange,
	onConfirm,
}: DeleteDomainDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
				<DialogHeader>
					<DialogTitle className="text-lg font-bold text-foreground">
						Remove Domain
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground mt-2">
						Are you sure you want to remove domain{" "}
						<span className="font-semibold text-foreground font-mono">
							{domain}
						</span>
						? This will stop routing incoming traffic from this path to your running container service.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
					>
						Cancel
					</Button>
					<Button
						onClick={onConfirm}
						className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs h-9 px-4 rounded-lg transition-all"
					>
						Remove Domain
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
