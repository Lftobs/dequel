import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from "../../ui/sheet";
import { Plus, Trash2 } from "lucide-react";

interface EnvVarEntry {
	key: string;
	value: string;
	env: string;
}

interface AddEnvVarSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (vars: EnvVarEntry[]) => Promise<void>;
}

export function AddEnvVarSheet({
	open,
	onOpenChange,
	onSubmit,
}: AddEnvVarSheetProps) {
	const [newVars, setNewVars] = useState<EnvVarEntry[]>([
		{ key: "", value: "", env: "" },
	]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const validVars = newVars.filter(
			(v) => v.key.trim() && v.value.trim(),
		);
		if (validVars.length === 0) return;
		await onSubmit(validVars);
		setNewVars([{ key: "", value: "", env: "" }]);
	};

	const close = () => {
		onOpenChange(false);
		setNewVars([{ key: "", value: "", env: "" }]);
	};

	const addRow = () => {
		setNewVars((prev) => [
			...prev,
			{ key: "", value: "", env: "" },
		]);
	};

	const removeRow = (index: number) => {
		setNewVars((prev) => prev.filter((_, i) => i !== index));
	};

	const updateRow = (
		index: number,
		field: keyof EnvVarEntry,
		val: string,
	) => {
		setNewVars((prev) =>
			prev.map((item, i) =>
				i === index ? { ...item, [field]: val } : item,
			),
		);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-[460px] bg-card border-border text-foreground shadow-2xl flex flex-col h-full">
				<SheetHeader>
					<SheetTitle>Add Environment Variables</SheetTitle>
					<SheetDescription>
						Store configuration keys that will be injected into your
						service deployments. You can add multiple variables at once.
					</SheetDescription>
				</SheetHeader>

				<form
					onSubmit={handleSubmit}
					className="flex flex-col flex-1 min-h-0"
				>
					<div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
						{newVars.map((v, index) => (
							<div
								key={index}
								className="p-4 rounded-xl bg-[#0a0a0d] border border-border/60 relative space-y-3 group"
							>
								{newVars.length > 1 && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => removeRow(index)}
										className="absolute top-3 right-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 rounded-lg transition-colors"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								)}
								<div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
									Variable #{index + 1}
								</div>
								<div className="space-y-1">
									<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
										Variable Key
									</label>
									<Input
										placeholder="e.g. DATABASE_URL"
										value={v.key}
										onChange={(e) =>
											updateRow(
												index,
												"key",
												e.target.value,
											)
										}
										className="h-9 bg-[#0d0d11] border-input focus:ring-1 focus:ring-primary text-xs font-semibold rounded-lg font-mono"
										required
									/>
								</div>

								<div className="space-y-1">
									<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
										Variable Value
									</label>
									<Input
										placeholder="e.g. postgresql://user:pass@host:5432/db"
										value={v.value}
										onChange={(e) =>
											updateRow(
												index,
												"value",
												e.target.value,
											)
										}
										className="h-9 bg-[#0d0d11] border-input focus:ring-1 focus:ring-primary text-xs font-semibold rounded-lg"
										required
									/>
								</div>

								<div className="space-y-1">
									<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
										Environment Scope (Optional)
									</label>
									<select
										value={v.env}
										onChange={(e) =>
											updateRow(
												index,
												"env",
												e.target.value,
											)
										}
										className="flex h-9 w-full rounded-lg border border-input bg-[#0d0d11] px-3 py-1.5 text-xs shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
									>
										<option value="">
											All Environments
										</option>
										<option value="production">
											Production
										</option>
										<option value="preview">
											Preview
										</option>
										<option value="development">
											Development
										</option>
									</select>
								</div>
							</div>
						))}

						<Button
							type="button"
							variant="outline"
							onClick={addRow}
							className="w-full border-dashed border-border hover:border-primary/40 hover:bg-secondary/20 text-xs font-semibold h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all"
						>
							<Plus className="h-3.5 w-3.5" /> Add Variable Row
						</Button>
					</div>

					<SheetFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={close}
							className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 text-xs px-5 rounded-lg shadow-lg hover:shadow-primary/20 transition-all"
						>
							Add Variables
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
