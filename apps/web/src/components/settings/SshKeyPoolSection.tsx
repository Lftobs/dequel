import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Trash2, KeyRound } from "lucide-react";
import * as api from "../../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";

export function SshKeyPoolSection() {
	const { data: keys = [], refetch } = useQuery({
		queryKey: ["ssh-keys"],
		queryFn: () => api.listSshKeys().catch(() => []),
	});
	const [name, setName] = useState("");
	const [privateKey, setPrivateKey] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !privateKey.trim()) return;
		await api.createSshKey({ name: name.trim(), privateKey: privateKey.trim() });
		setName("");
		setPrivateKey("");
		refetch();
	};

	const handleDelete = async () => {
		if (!deletingId) return;
		await api.deleteSshKey(deletingId);
		setDeletingId(null);
		refetch();
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<KeyRound className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-lg">SSH Key Pool</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<form onSubmit={add} className="flex flex-wrap items-end gap-3 mb-4">
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Name</label>
						<Input placeholder="worker-1" value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
					</div>
					<div className="grid gap-1.5 flex-1 min-w-[300px]">
						<label className="text-xs font-medium text-muted-foreground">Private Key (PEM)</label>
						<textarea
							placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
							value={privateKey}
							onChange={(e) => setPrivateKey(e.target.value)}
							className="flex w-full rounded-xl border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] font-mono"
						/>
					</div>
					<Button type="submit" size="sm">Add Key</Button>
				</form>
				{keys.length > 0 && (
					<div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
						<Table className="min-w-[500px] md:min-w-full">
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Fingerprint</TableHead>
									<TableHead>Tags</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="w-12"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{keys.map((k) => (
									<TableRow key={k.id}>
										<TableCell className="font-medium">{k.name}</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground">{k.fingerprint}</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{k.tags?.length > 0 ? k.tags.join(", ") : "—"}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</TableCell>
										<TableCell className="text-right">
											<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
												onClick={() => setDeletingId(k.id)}>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
			<Dialog open={deletingId !== null} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Delete SSH Key</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Servers using this key will fall back to inline keys. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button variant="ghost" onClick={() => setDeletingId(null)}
							className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]">Cancel</Button>
						<Button onClick={handleDelete}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all">Delete</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
