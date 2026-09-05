import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
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
	const [key, setKey] = useState("");
	const [value, setValue] = useState("");
	const [description, setDescription] = useState("");
	const [revealedId, setRevealedId] = useState<string | null>(null);
	const [revealedValue, setRevealedValue] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!key.trim() || !value.trim()) return;
		await api.createSharedEnvVar({
			key: key.trim(),
			value: value.trim(),
			description: description.trim() || undefined,
		});
		setKey("");
		setValue("");
		setDescription("");
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

	const handleDelete = async () => {
		if (!deletingId) return;
		await api.deleteSharedEnvVar(deletingId);
		setDeletingId(null);
		refetch();
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Share2 className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-lg">Shared Environment Variables</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<form onSubmit={add} className="flex flex-wrap items-end gap-3 mb-4">
					<div className="grid gap-1.5">
						<label htmlFor="shared-env-key" className="text-xs font-medium text-muted-foreground">
							Key
						</label>
						<Input
							id="shared-env-key"
							placeholder="DATABASE_URL"
							value={key}
							onChange={(e) => setKey(e.target.value)}
							className="w-48"
						/>
					</div>
					<div className="grid gap-1.5">
						<label htmlFor="shared-env-value" className="text-xs font-medium text-muted-foreground">
							Value
						</label>
						<Input
							id="shared-env-value"
							placeholder="postgres://..."
							value={value}
							onChange={(e) => setValue(e.target.value)}
							className="w-64"
							type="password"
						/>
					</div>
					<div className="grid gap-1.5">
						<label htmlFor="shared-env-desc" className="text-xs font-medium text-muted-foreground">
							Description
						</label>
						<Input
							id="shared-env-desc"
							placeholder="Main database URL"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="w-48"
						/>
					</div>
					<Button type="submit" size="sm">
						Add
					</Button>
				</form>
				{vars.length > 0 && (
					<div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
						<Table className="min-w-[600px] md:min-w-full">
							<TableHeader>
								<TableRow>
									<TableHead>Key</TableHead>
									<TableHead>Value</TableHead>
									<TableHead>Environment</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="w-20"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{vars.map((v) => (
									<TableRow key={v.id}>
										<TableCell className="font-mono text-xs font-medium">{v.key}</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground">
											{revealedId === v.id ? revealedValue : "••••••••"}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">{v.environment}</TableCell>
										<TableCell className="text-xs text-muted-foreground">{v.description || "—"}</TableCell>
										<TableCell className="text-right flex gap-1 justify-end">
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-muted-foreground hover:text-foreground"
												onClick={() => handleReveal(v.id)}
											>
												{revealedId === v.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-muted-foreground hover:text-destructive"
												onClick={() => setDeletingId(v.id)}
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
				open={deletingId !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingId(null);
				}}
			>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Delete Shared Variable</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Projects linked to this variable will lose access. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() => setDeletingId(null)}
							className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							onClick={handleDelete}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
