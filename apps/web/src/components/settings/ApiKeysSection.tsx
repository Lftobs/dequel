import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Key, Plus, ShieldCheck, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

const SCOPE_PRESETS = [
	{ id: "cicd", label: "CI/CD Pipeline", icon: Zap },
	{ id: "monitoring", label: "Monitoring & Logs", icon: ShieldCheck },
	{ id: "admin", label: "Full Admin Access", icon: Key },
];

export function ApiKeysSection() {
	const { data: apiKeys = [], refetch } = useQuery({
		queryKey: ["api-keys"],
		queryFn: () => api.listApiKeys().catch(() => []),
	});

	const [name, setName] = useState("");
	const [selectedScope, setSelectedScope] = useState("cicd");
	const [newKey, setNewKey] = useState("");
	const [showKey, setShowKey] = useState(true);
	const [copied, setCopied] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

	const handleDeleteKey = async () => {
		if (!deletingKeyId) return;
		await api.deleteApiKey(deletingKeyId);
		setDeletingKeyId(null);
		refetch();
	};

	const handleCopy = () => {
		if (!newKey) return;
		navigator.clipboard.writeText(newKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		const scopeLabel = SCOPE_PRESETS.find((s) => s.id === selectedScope)?.label || "API Token";
		const keyName = `${name.trim()} (${scopeLabel})`;
		const result = await api.createApiKey({ name: keyName });
		setNewKey(result.rawKey || "");
		setName("");
		setIsCreating(false);
		refetch();
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
							<Key className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg font-semibold text-foreground">API Access Tokens</CardTitle>
							<p className="text-xs text-muted-foreground mt-0.5">
								Authentication tokens for CLI, CI/CD automation, and API integration.
							</p>
						</div>
					</div>
					<Button
						onClick={() => setIsCreating(!isCreating)}
						size="sm"
						className="bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md transition-all gap-1.5 self-start sm:self-auto"
					>
						<Plus className="h-4 w-4" />
						Generate Token
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-6 space-y-6">
				{newKey && (
					<div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 backdrop-blur-md space-y-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
								<ShieldCheck className="h-4 w-4" />
								New Token Created — Save it immediately
							</div>
							<Badge variant="success" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
								Active
							</Badge>
						</div>

						<div className="relative flex items-center">
							<input
								type={showKey ? "text" : "password"}
								readOnly
								value={newKey}
								className="w-full rounded-xl border border-emerald-500/30 bg-black/40 px-4 py-3 pr-24 font-mono text-xs text-emerald-300 focus:outline-none"
							/>
							<div className="absolute right-2 flex items-center gap-1">
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/20"
									onClick={() => setShowKey(!showKey)}
								>
									{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</Button>
								<Button
									type="button"
									size="sm"
									onClick={handleCopy}
									className="h-8 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs px-3 rounded-lg gap-1.5 transition-all"
								>
									{copied ? (
										<>
											<Check className="h-3.5 w-3.5" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-3.5 w-3.5" />
											Copy Token
										</>
									)}
								</Button>
							</div>
						</div>
						<p className="text-[11px] text-emerald-400/80">
							This secret key will never be displayed again. Make sure to copy it now to your secrets vault.
						</p>
					</div>
				)}

				{isCreating && (
					<form
						onSubmit={add}
						className="rounded-2xl border border-border/80 bg-background/40 p-5 space-y-4 shadow-inner"
					>
						<div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Token Details & Permissions
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Token Label / Purpose</label>
								<Input
									placeholder="e.g. github-actions-deploy"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="bg-card border-border/80 text-xs focus:ring-orange-500/50"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Token Scope Preset</label>
								<div className="grid grid-cols-3 gap-2">
									{SCOPE_PRESETS.map((scope) => {
										const Icon = scope.icon;
										const isSelected = selectedScope === scope.id;
										return (
											<button
												key={scope.id}
												type="button"
												onClick={() => setSelectedScope(scope.id)}
												className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-medium transition-all ${
													isSelected
														? "border-orange-500/60 bg-orange-500/10 text-orange-400 shadow-sm"
														: "border-border/60 bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground"
												}`}
											>
												<Icon className="h-3.5 w-3.5" />
												<span className="hidden md:inline">{scope.label}</span>
											</button>
										);
									})}
								</div>
							</div>
						</div>
						<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setIsCreating(false)}
								className="text-xs text-muted-foreground hover:text-foreground"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								size="sm"
								className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-4"
							>
								Generate Key
							</Button>
						</div>
					</form>
				)}

				{apiKeys.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-12 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground mb-3">
							<Key className="h-6 w-6" />
						</div>
						<h3 className="text-sm font-semibold text-foreground">No API Tokens Found</h3>
						<p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
							Generate access tokens to allow external deployment tools and CI scripts to authenticate with Dequel.
						</p>
						<Button
							size="sm"
							onClick={() => setIsCreating(true)}
							variant="outline"
							className="text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
						>
							Create First API Key
						</Button>
					</div>
				) : (
					<div className="rounded-xl border border-border/60 overflow-hidden bg-card/30">
						<div className="md:hidden divide-y divide-border/40">
							{apiKeys.map((k) => (
								<div key={k.id} className="p-3.5 flex items-center justify-between gap-3">
									<div className="space-y-1 min-w-0">
										<div className="flex items-center gap-2">
											<div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
											<p className="font-medium text-sm text-foreground truncate">{k.name}</p>
										</div>
										<p className="font-mono text-xs text-muted-foreground">dequel_sec_{k.keyHash?.slice(0, 8)}...</p>
										<p className="text-[11px] text-muted-foreground/70">{new Date(k.createdAt).toLocaleDateString()}</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
										onClick={() => setDeletingKeyId(k.id)}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							))}
						</div>

						<div className="hidden md:block overflow-x-auto">
							<Table className="w-full">
								<TableHeader className="bg-muted/40">
									<TableRow className="border-border/60 hover:bg-transparent">
										<TableHead className="text-xs font-semibold">Token Label</TableHead>
										<TableHead className="text-xs font-semibold">Key Hash</TableHead>
										<TableHead className="text-xs font-semibold">Created Date</TableHead>
										<TableHead className="text-xs font-semibold text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{apiKeys.map((k) => (
										<TableRow key={k.id} className="border-border/40 hover:bg-muted/20">
											<TableCell className="font-medium text-foreground text-xs py-3.5">
												<div className="flex items-center gap-2">
													<div className="h-2 w-2 rounded-full bg-emerald-500" />
													<span>{k.name}</span>
												</div>
											</TableCell>
											<TableCell className="font-mono text-xs text-muted-foreground py-3.5">
												<Badge
													variant="outline"
													className="font-mono text-[11px] bg-black/40 text-zinc-400 border-border/60"
												>
													dequel_sec_{k.keyHash?.slice(0, 8)}...
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground text-xs py-3.5">
												{new Date(k.createdAt).toLocaleDateString(undefined, {
													year: "numeric",
													month: "short",
													day: "numeric",
												})}
											</TableCell>
											<TableCell className="text-right py-3.5">
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
													onClick={() => setDeletingKeyId(k.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>
				)}
			</CardContent>

			<Dialog open={deletingKeyId !== null} onOpenChange={(open) => !open && setDeletingKeyId(null)}>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Revoke API Access Key</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
							Are you sure you want to revoke this API token? Any active deployment services or scripts using this token
							will fail immediately.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() => setDeletingKeyId(null)}
							className="h-9 text-xs px-4 rounded-xl hover:bg-muted"
						>
							Cancel
						</Button>
						<Button
							onClick={handleDeleteKey}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-9 text-xs px-5 rounded-xl shadow-lg transition-all"
						>
							Revoke Key
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
