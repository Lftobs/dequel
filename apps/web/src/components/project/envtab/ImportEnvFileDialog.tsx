import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "../../ui/dialog";
import { Upload, Check } from "lucide-react";

interface ImportEnvFileDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImport: (vars: { key: string; value: string }[]) => Promise<void>;
}

export function ImportEnvFileDialog({
	open,
	onOpenChange,
	onImport,
}: ImportEnvFileDialogProps) {
	const [parsedFileVars, setParsedFileVars] = useState<
		{ key: string; value: string }[] | null
	>(null);
	const [importStatus, setImportStatus] = useState<
		"idle" | "importing" | "done"
	>("idle");
	const [fileError, setFileError] = useState("");
	const [fileInputKey, setFileInputKey] = useState(0);

	const parseEnvLines = (text: string) => {
		const lines = text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));
		return lines
			.map((line) => {
				const idx = line.indexOf("=");
				if (idx <= 0) return null;
				const k = line.slice(0, idx).trim();
				let v = line.slice(idx + 1).trim();
				if (
					(v.startsWith('"') && v.endsWith('"')) ||
					(v.startsWith("'") && v.endsWith("'"))
				) {
					v = v.slice(1, -1);
				}
				if (!k) return null;
				return { key: k, value: v };
			})
			.filter(Boolean) as { key: string; value: string }[];
	};

	const handleFileSelect = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		setFileError("");
		setImportStatus("idle");
		const file = e.target.files?.[0];
		if (!file) {
			setParsedFileVars(null);
			return;
		}
		const text = await file.text();
		const vars = parseEnvLines(text);
		if (!vars.length) {
			setFileError("No valid KEY=VALUE pairs found in file.");
			setParsedFileVars(null);
			setFileInputKey((k) => k + 1);
			e.target.value = "";
			return;
		}
		setParsedFileVars(vars);
	};

	const handleImport = async () => {
		if (!parsedFileVars?.length) return;
		setImportStatus("importing");
		setFileError("");
		try {
			await onImport(parsedFileVars);
			setImportStatus("done");
			setParsedFileVars(null);
			setFileInputKey((k) => k + 1);
			setTimeout(() => {
				setImportStatus("idle");
				onOpenChange(false);
			}, 1500);
		} catch {
			setFileError("Import failed. Try again.");
			setImportStatus("idle");
		}
	};

	const close = () => {
		onOpenChange(false);
		setParsedFileVars(null);
		setFileError("");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[450px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
				<DialogHeader>
					<DialogTitle className="text-lg font-bold text-foreground">
						Import .env File
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Upload a local configuration file to quickly populate keys.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 pt-2">
					<div className="relative border-2 border-dashed border-border rounded-xl p-6 hover:border-primary/40 transition-colors bg-[#0d0d11]/40 flex flex-col items-center justify-center text-center group">
						<Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
						<p className="text-xs font-semibold text-foreground mb-1">
							Select a file or drag here
						</p>
						<p className="text-[10px] text-muted-foreground">
							Supports .env or .txt key-value files
						</p>
						<Input
							key={fileInputKey}
							type="file"
							accept=".env,.txt"
							onChange={handleFileSelect}
							className="absolute inset-0 opacity-0 cursor-pointer"
						/>
					</div>

					{parsedFileVars && importStatus !== "done" && (
						<div className="space-y-3">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">
									Parsed variables:
								</span>
								<span className="font-semibold text-primary">
									{parsedFileVars.length} found
								</span>
							</div>
							<div className="max-h-[140px] overflow-y-auto border border-border rounded-lg bg-[#070709] divide-y divide-border/40 font-mono text-[10px]">
								{parsedFileVars.slice(0, 10).map((v, idx) => (
									<div
										key={idx}
										className="flex items-center justify-between p-2"
									>
										<span className="text-foreground font-semibold truncate max-w-[150px]">
											{v.key}
										</span>
										<span className="text-muted-foreground truncate max-w-[200px]">
											{v.value}
										</span>
									</div>
								))}
								{parsedFileVars.length > 10 && (
									<div className="p-2 text-center text-muted-foreground/60 italic border-t border-border/40">
										+{parsedFileVars.length - 10} more
										variables
									</div>
								)}
							</div>
						</div>
					)}

					{fileError && (
						<div className="text-xs text-destructive flex items-center gap-1.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 font-semibold">
							{fileError}
						</div>
					)}

					{importStatus === "done" && (
						<div className="text-xs text-emerald-400 flex items-center justify-center gap-1.5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-semibold">
							<Check className="h-4 w-4" /> Successfully Imported
							Variables!
						</div>
					)}

					<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
						<Button
							type="button"
							variant="ghost"
							onClick={close}
							className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
							disabled={importStatus === "importing"}
						>
							Cancel
						</Button>
						{parsedFileVars && importStatus !== "done" && (
							<Button
								onClick={handleImport}
								disabled={importStatus === "importing"}
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all"
							>
								{importStatus === "importing"
									? "Importing..."
									: `Import ${parsedFileVars.length} Variables`}
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
