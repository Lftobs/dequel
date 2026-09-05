import { useQuery } from "@tanstack/react-query";
import { Key, Trash2 } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

export function ApiKeysSection() {
	const { data: apiKeys = [], refetch } = useQuery({
		queryKey: ["api-keys"],
		queryFn: () => api.listApiKeys().catch(() => []),
	});
	const [name, setName] = useState("");
	const [newKey, setNewKey] = useState("");
	const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

	const handleDeleteKey = async () => {
		if (!deletingKeyId) return;
		await api.deleteApiKey(deletingKeyId);
		setDeletingKeyId(null);
		refetch();
	};

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		const result = await api.createApiKey({ name: name.trim() });
		setNewKey(result.rawKey || "");
		setName("");
		refetch();
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Key className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-lg">API Keys</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				{newKey && (
					<div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-400">
						<strong className="block mb-1">API Key created — copy it now:</strong>
						<code className="block bg-emerald-950/50 rounded px-2 py-1 font-mono text-xs break-all">{newKey}</code>
					</div>
				)}
				<form onSubmit={add} className="flex flex-wrap items-end gap-3 mb-4">
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Key Name</label>
						<Input placeholder="ci-cd-token" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
					</div>
					<Button type="submit" size="sm">
						Generate Key
					</Button>
				</form>
				{apiKeys.length > 0 && (
					<div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
						<Table className="min-w-[500px] md:min-w-full">
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Key Hash</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="w-12"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{apiKeys.map((k) => (
									<TableRow key={k.id}>
										<TableCell className="font-medium">{k.name}</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground">
											{k.keyHash?.slice(0, 12)}...
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(k.createdAt).toLocaleDateString()}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-muted-foreground hover:text-destructive"
												onClick={() => setDeletingKeyId(k.id)}
											>
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

			<Dialog
				open={deletingKeyId !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingKeyId(null);
				}}
			>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Delete API Key</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Are you sure you want to delete this API key? Any services using it will lose access immediately.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() => setDeletingKeyId(null)}
							className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							onClick={handleDeleteKey}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all"
						>
							Delete Key
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
