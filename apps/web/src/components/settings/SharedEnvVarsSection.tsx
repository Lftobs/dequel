import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Plus, Share2, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

export function SharedEnvVarsSection() {
	const { data: vars = [], refetch } = useQuery({
		queryKey: ["shared-env-vars"],
		queryFn: () => api.listSharedEnvVars().catch(() => []),
	});

	const [isAdding, setIsAdding] = useState(false);
	const [key, setKey] = useState("");
	const [value, setValue] = useState("");
	const [description, setDescription] = useState("");
	const [showValueInput, setShowValueInput] = useState(false);
	const [revealedId, setRevealedId] = useState<string | null>(null);
	const [revealedValue, setRevealedValue] = useState("");
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!key.trim() || !value.trim()) return;
		await api.createSharedEnvVar({
			key: key.trim().toUpperCase(),
			value: value.trim(),
			description: description.trim() || undefined,
		});
		setKey("");
		setValue("");
		setDescription("");
		setIsAdding(false);
		refetch();
	};

	const handleReveal = async (id: string) => {
		if (revealedId === id) {
			setRevealedId(null);
			setRevealedValue("");
			return;
		}
		const result = await api.revealSharedEnvVar(id);
		setRevealedId(id);
		setRevealedValue(result.value);
	};

	const handleCopyValue = (id: string, secretValue: string) => {
		navigator.clipboard.writeText(secretValue);
		setCopiedId(id);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const handleDelete = async () => {
		if (!deletingId) return;
		await api.deleteSharedEnvVar(deletingId);
		setDeletingId(null);
		refetch();
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
							<Share2 className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg font-semibold text-foreground">Shared Environment Variables</CardTitle>
							<p className="text-xs text-muted-foreground mt-0.5">
								Global environment variables automatically injected into all project containers during deployment.
							</p>
						</div>
					</div>
					<Button
						onClick={() => setIsAdding(!isAdding)}
						size="sm"
						className="bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md transition-all gap-1.5 self-start sm:self-auto"
					>
						<Plus className="h-4 w-4" />
						Add Variable
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-6 space-y-6">
				{isAdding && (
					<form
						onSubmit={add}
						className="rounded-2xl border border-border/80 bg-background/40 p-5 space-y-4 shadow-inner"
					>
						<div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Create Global Variable
						</div>
						<div className="grid gap-4 sm:grid-cols-3">
							<div className="space-y-1.5">
								<label htmlFor="shared-env-key" className="text-xs font-medium text-foreground">
									Variable Key
								</label>
								<Input
									id="shared-env-key"
									placeholder="e.g. GLOBAL_API_KEY"
									value={key}
									onChange={(e) => setKey(e.target.value.toUpperCase())}
									className="bg-card border-border/80 font-mono text-xs focus:ring-orange-500/50 uppercase"
									required
								/>
							</div>

							<div className="space-y-1.5">
								<label htmlFor="shared-env-value" className="text-xs font-medium text-foreground">
									Value
								</label>
								<div className="relative flex items-center">
									<Input
										id="shared-env-value"
										type={showValueInput ? "text" : "password"}
										placeholder="Secret value..."
										value={value}
										onChange={(e) => setValue(e.target.value)}
										className="bg-card border-border/80 font-mono text-xs focus:ring-orange-500/50 pr-10"
										required
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => setShowValueInput(!showValueInput)}
										className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
									>
										{showValueInput ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
									</Button>
								</div>
							</div>

							<div className="space-y-1.5">
								<label htmlFor="shared-env-desc" className="text-xs font-medium text-foreground">
									Description (Optional)
								</label>
								<Input
									id="shared-env-desc"
									placeholder="Central Auth Endpoint"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									className="bg-card border-border/80 text-xs focus:ring-orange-500/50"
								/>
							</div>
						</div>

						<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setIsAdding(false)}
								className="text-xs text-muted-foreground hover:text-foreground"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								size="sm"
								className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-4"
							>
								Save Variable
							</Button>
						</div>
					</form>
				)}

				{vars.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-12 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground mb-3">
							<Shield className="h-6 w-6" />
						</div>
						<h3 className="text-sm font-semibold text-foreground">No Shared Variables</h3>
						<p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
							Define reusable secrets and environment variables once to share across all deployed applications.
						</p>
						<Button
							size="sm"
							onClick={() => setIsAdding(true)}
							variant="outline"
							className="text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
						>
							Add First Shared Variable
						</Button>
					</div>
				) : (
					<div className="rounded-xl border border-border/60 overflow-hidden bg-card/30">
						<Table>
							<TableHeader className="bg-muted/40">
								<TableRow className="border-border/60 hover:bg-transparent">
									<TableHead className="text-xs font-semibold">Variable Key</TableHead>
									<TableHead className="text-xs font-semibold">Secret Value</TableHead>
									<TableHead className="text-xs font-semibold">Target Scope</TableHead>
									<TableHead className="text-xs font-semibold">Description</TableHead>
									<TableHead className="text-xs font-semibold text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{vars.map((v) => (
									<TableRow key={v.id} className="border-border/40 hover:bg-muted/20">
										<TableCell className="font-mono text-xs font-medium text-orange-400 py-3.5">
											<Badge
												variant="outline"
												className="font-mono text-[11px] bg-black/40 border-border/60 text-orange-300"
											>
												{v.key}
											</Badge>
										</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground py-3.5">
											{revealedId === v.id ? (
												<span className="text-emerald-300 font-semibold">{revealedValue}</span>
											) : (
												<span className="text-zinc-500">••••••••••••</span>
											)}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground py-3.5">
											<Badge variant="secondary" className="text-[10px] bg-secondary/80 text-zinc-300">
												{v.environment || "All Environments"}
											</Badge>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground py-3.5">{v.description || "—"}</TableCell>
										<TableCell className="text-right py-3.5">
											<div className="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
													onClick={() => handleReveal(v.id)}
												>
													{revealedId === v.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
												</Button>

												{revealedId === v.id && (
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-muted-foreground hover:text-emerald-400 rounded-lg"
														onClick={() => handleCopyValue(v.id, revealedValue)}
													>
														{copiedId === v.id ? (
															<Check className="h-4 w-4 text-emerald-400" />
														) : (
															<Copy className="h-4 w-4" />
														)}
													</Button>
												)}

												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
													onClick={() => setDeletingId(v.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>

			<Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Delete Shared Variable</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
							Are you sure you want to remove this variable? Projects depending on this environment key will fall back
							to local project defaults.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() => setDeletingId(null)}
							className="h-9 text-xs px-4 rounded-xl hover:bg-muted"
						>
							Cancel
						</Button>
						<Button
							onClick={handleDelete}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-9 text-xs px-5 rounded-xl shadow-lg transition-all"
						>
							Delete Variable
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
