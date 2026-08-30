import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";

interface AddDomainDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	domain: string;
	setDomain: (v: string) => void;
	targetService: string;
	setTargetService: (v: string) => void;
	targetPort: string;
	setTargetPort: (v: string) => void;
	isCompose: boolean;
	isAdding: boolean;
	onAdd: (e: React.FormEvent) => Promise<void>;
}

export function AddDomainDialog({
	open,
	onOpenChange,
	domain,
	setDomain,
	targetService,
	setTargetService,
	targetPort,
	setTargetPort,
	isCompose,
	isAdding,
	onAdd,
}: AddDomainDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
				<DialogHeader>
					<DialogTitle className="text-lg font-bold text-foreground">
						Add Custom Domain
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Attach domain endpoints to route external web requests to your container proxy.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onAdd} className="space-y-4 pt-2">
					<div className="grid gap-2">
						<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Domain Address
						</label>
						<Input
							placeholder="e.g. app.mycompany.com"
							value={domain}
							onChange={(e) => setDomain(e.target.value)}
							className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg font-mono"
							required
						/>
					</div>

					{isCompose && (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
							<div className="grid gap-1.5">
								<label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
									Service Name
								</label>
								<Input
									placeholder="e.g. api or web"
									value={targetService}
									onChange={(e) => setTargetService(e.target.value)}
									className="h-9 bg-[#0d0d11] border-input text-xs font-mono rounded-lg"
								/>
							</div>
							<div className="grid gap-1.5">
								<label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
									Service Port
								</label>
								<Input
									placeholder="e.g. 8080"
									type="number"
									value={targetPort}
									onChange={(e) => setTargetPort(e.target.value)}
									className="h-9 bg-[#0d0d11] border-input text-xs font-mono rounded-lg"
								/>
							</div>
						</div>
					)}

					<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
							className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
							disabled={isAdding}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isAdding}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all"
						>
							{isAdding ? "Adding..." : "Add Domain"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
