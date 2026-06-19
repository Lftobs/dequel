import { Button } from "../../ui/button";
import { KeyRound, Plus, Upload } from "lucide-react";

interface EmptyEnvStateProps {
	onAdd: () => void;
	onImport: () => void;
}

export function EmptyEnvState({ onAdd, onImport }: EmptyEnvStateProps) {
	return (
		<div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-12 text-center bg-card/20 backdrop-blur-sm relative overflow-hidden group min-h-[350px]">
			<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
			<div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1a1a1f] to-[#121215] border border-border flex items-center justify-center mb-6 shadow-xl group-hover:border-primary/30 transition-colors duration-300">
				<div className="absolute inset-0 bg-primary/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
				<KeyRound className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
			</div>
			<h3 className="text-lg font-semibold text-foreground mb-2">
				No Environment Variables
			</h3>
			<p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
				Store encrypted configuration secrets, API credentials, and database
				URIs injected dynamically into your container at runtime.
			</p>
			<div className="flex items-center gap-3">
				<Button
					onClick={onAdd}
					className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-5 h-10 rounded-xl transition-all shadow-lg hover:shadow-primary/20"
				>
					<Plus className="h-4 w-4" /> Add Variable
				</Button>
				<Button
					variant="outline"
					onClick={onImport}
					className="border-border hover:bg-secondary/50 font-semibold flex items-center gap-1.5 px-5 h-10 rounded-xl transition-all"
				>
					<Upload className="h-4 w-4" /> Import .env File
				</Button>
			</div>
		</div>
	);
}
