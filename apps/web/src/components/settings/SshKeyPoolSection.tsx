import { useQuery } from "@tanstack/react-query";
import { KeyRound, Plus, Shield, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import * as api from "../../api/client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

export function SshKeyPoolSection() {
	const { data: keys = [], refetch } = useQuery({
		queryKey: ["ssh-keys"],
		queryFn: () => api.listSshKeys().catch(() => []),
	});

	const [name, setName] = useState("");
	const [privateKey, setPrivateKey] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const detectedType = privateKey.includes("ED25519")
		? "Ed25519"
		: privateKey.includes("RSA")
			? "RSA"
			: privateKey.trim()
				? "OpenSSH"
				: null;

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			if (content) {
				setPrivateKey(content);
				if (!name) {
					setName(file.name.replace(/\.(pem|key|pub)$/i, ""));
				}
			}
		};
		reader.readAsText(file);
	};

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !privateKey.trim()) return;
		await api.createSshKey({ name: name.trim(), privateKey: privateKey.trim() });
		setName("");
		setPrivateKey("");
		setIsAdding(false);
		refetch();
	};

	const handleDelete = async () => {
		if (!deletingId) return;
		await api.deleteSshKey(deletingId);
		setDeletingId(null);
		refetch();
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
							<KeyRound className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg font-semibold text-foreground">SSH Key Pool</CardTitle>
							<p className="text-xs text-muted-foreground mt-0.5">
								SSH keys pool used to authenticate and deploy containers across remote cluster nodes.
							</p>
						</div>
					</div>
					<Button
						onClick={() => setIsAdding(!isAdding)}
						size="sm"
						className="bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md transition-all gap-1.5 self-start sm:self-auto"
					>
						<Plus className="h-4 w-4" />
						Add SSH Key
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-6 space-y-6">
				{isAdding && (
					<form
						onSubmit={add}
						className="rounded-2xl border border-border/80 bg-background/40 p-5 space-y-4 shadow-inner"
					>
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Add SSH Private Key
							</span>
							{detectedType && (
								<Badge variant="info" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px]">
									Detected Format: {detectedType}
								</Badge>
							)}
						</div>

						<div className="space-y-4">
							<div className="grid gap-1.5">
								<label htmlFor="ssh-key-name" className="text-xs font-medium text-foreground">
									Key Identifier / Server Tag
								</label>
								<Input
									id="ssh-key-name"
									placeholder="e.g. hetzner-prod-key"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="bg-card border-border/80 text-xs focus:ring-orange-500/50 max-w-md"
									required
								/>
							</div>

							<div className="grid gap-1.5">
								<div className="flex items-center justify-between">
									<label htmlFor="ssh-key-pem" className="text-xs font-medium text-foreground">
										Private Key (PEM format)
									</label>
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleFileUpload}
										className="hidden"
										accept=".pem,.key,.pub"
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => fileInputRef.current?.click()}
										className="h-7 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1 px-2"
									>
										<Upload className="h-3 w-3" />
										Upload File
									</Button>
								</div>
								<textarea
									id="ssh-key-pem"
									placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
									value={privateKey}
									onChange={(e) => setPrivateKey(e.target.value)}
									rows={4}
									className="w-full rounded-xl border border-border/80 bg-black/50 p-3 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
									required
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
								Add Key to Pool
							</Button>
						</div>
					</form>
				)}

				{keys.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-12 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground mb-3">
							<Shield className="h-6 w-6" />
						</div>
						<h3 className="text-sm font-semibold text-foreground">No SSH Keys in Pool</h3>
						<p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
							Store private SSH keys centrally to enable one-click deployments to remote cloud servers.
						</p>
						<Button
							size="sm"
							onClick={() => setIsAdding(true)}
							variant="outline"
							className="text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
						>
							Add First SSH Key
						</Button>
					</div>
				) : (
					<div className="rounded-xl border border-border/60 overflow-hidden bg-card/30">
						<Table>
							<TableHeader className="bg-muted/40">
								<TableRow className="border-border/60 hover:bg-transparent">
									<TableHead className="text-xs font-semibold">Key Identifier</TableHead>
									<TableHead className="text-xs font-semibold">Fingerprint</TableHead>
									<TableHead className="text-xs font-semibold">Tags</TableHead>
									<TableHead className="text-xs font-semibold">Added Date</TableHead>
									<TableHead className="text-xs font-semibold text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{keys.map((k) => (
									<TableRow key={k.id} className="border-border/40 hover:bg-muted/20">
										<TableCell className="font-medium text-foreground text-xs py-3.5">
											<div className="flex items-center gap-2">
												<KeyRound className="h-4 w-4 text-orange-400/80" />
												<span>{k.name}</span>
											</div>
										</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground py-3.5">
											<Badge
												variant="outline"
												className="font-mono text-[11px] bg-black/40 text-zinc-400 border-border/60"
											>
												{k.fingerprint || "SHA256:..."}
											</Badge>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground py-3.5">
											{k.tags && k.tags.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{k.tags.map((tag, i) => (
														<Badge key={i} variant="secondary" className="text-[10px] py-0 px-1.5">
															{tag}
														</Badge>
													))}
												</div>
											) : (
												<span className="text-muted-foreground/60">—</span>
											)}
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
												onClick={() => setDeletingId(k.id)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
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
						<DialogTitle className="text-lg font-bold text-foreground">Delete SSH Key</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
							Are you sure you want to remove this key from the pool? Servers relying on this key will lose remote
							management access.
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
							Delete Key
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
