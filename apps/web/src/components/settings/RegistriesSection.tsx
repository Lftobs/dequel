import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Container, Pencil, Plus, Trash2, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import * as api from "../../api/client";
import type { Registry } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface FormState {
	name: string;
	url: string;
	username: string;
	password: string;
}

const emptyForm: FormState = { name: "", url: "", username: "", password: "" };

export function RegistriesSection() {
	const queryClient = useQueryClient();
	const { data: registries = [], refetch } = useQuery({
		queryKey: ["registries"],
		queryFn: () => api.listRegistries().catch(() => []),
	});

	const [isCreating, setIsCreating] = useState(false);
	const [editing, setEditing] = useState<Registry | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const patch = (value: Partial<FormState>) => setForm((current) => ({ ...current, ...value }));

	const openCreate = () => {
		setEditing(null);
		setForm(emptyForm);
		setError("");
		setIsCreating(true);
	};

	const openEdit = (registry: Registry) => {
		setEditing(registry);
		setForm({
			name: registry.name,
			url: registry.url,
			username: registry.username,
			password: "",
		});
		setError("");
		setIsCreating(true);
	};

	const closeForm = () => {
		setIsCreating(false);
		setEditing(null);
		setForm(emptyForm);
		setError("");
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError("");
		try {
			if (editing) {
				await api.updateRegistry(editing.id, {
					name: form.name.trim(),
					url: form.url.trim(),
					username: form.username.trim(),
					...(form.password ? { password: form.password } : {}),
				});
			} else {
				await api.createRegistry({
					name: form.name.trim(),
					url: form.url.trim(),
					username: form.username.trim(),
					password: form.password,
				});
			}
			closeForm();
			refetch();
			queryClient.invalidateQueries({ queryKey: ["registries"] });
		} catch (err: any) {
			setError(err.message || "Failed to save registry");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		setDeletingId(id);
		try {
			await api.deleteRegistry(id);
			refetch();
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
							<Container className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg font-semibold text-foreground">Container Registries</CardTitle>
							<p className="text-xs text-muted-foreground mt-0.5">
								Credentials for pulling private Docker images during deployments.
							</p>
						</div>
					</div>
					<Button
						onClick={isCreating ? closeForm : openCreate}
						size="sm"
						className="bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md transition-all gap-1.5 self-start sm:self-auto"
					>
						{isCreating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
						{isCreating ? "Close" : "Add Registry"}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-6 space-y-6">
				{isCreating && (
					<form onSubmit={handleSubmit} className="rounded-2xl border border-border/80 bg-background/40 p-5 space-y-4">
						{error && (
							<div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
								{error}
							</div>
						)}
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Registry Name</label>
								<Input
									placeholder="e.g. GitHub Container Registry"
									value={form.name}
									onChange={(e) => patch({ name: e.target.value })}
									className="bg-card border-border/80 text-xs"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Registry Host</label>
								<Input
									placeholder="e.g. ghcr.io"
									value={form.url}
									onChange={(e) => patch({ url: e.target.value })}
									className="bg-card border-border/80 text-xs font-mono"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Username</label>
								<Input
									placeholder="e.g. deploy-bot"
									value={form.username}
									onChange={(e) => patch({ username: e.target.value })}
									className="bg-card border-border/80 text-xs font-mono"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">
									Password / Token {editing && <span className="text-muted-foreground">(leave blank to keep)</span>}
								</label>
								<Input
									type="password"
									placeholder={editing?.hasPassword ? "Stored password" : "Access token"}
									value={form.password}
									onChange={(e) => patch({ password: e.target.value })}
									className="bg-card border-border/80 text-xs"
									required={!editing}
								/>
							</div>
						</div>
						<p className="text-[10px] text-muted-foreground">
							Credentials are encrypted at rest and only used for image pulls on the deployment server.
						</p>
						<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
							<Button type="button" variant="ghost" size="sm" onClick={closeForm} className="text-xs">
								Cancel
							</Button>
							<Button
								type="submit"
								size="sm"
								disabled={saving}
								className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-4"
							>
								{saving ? "Saving..." : editing ? "Save Registry" : "Add Registry"}
							</Button>
						</div>
					</form>
				)}

				{registries.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-12 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground mb-3">
							<Container className="h-6 w-6" />
						</div>
						<h3 className="text-sm font-semibold text-foreground">No Registries Configured</h3>
						<p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
							Add private registry credentials so Dequel can pull images for image-based projects.
						</p>
						<Button
							size="sm"
							onClick={openCreate}
							variant="outline"
							className="text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
						>
							Add First Registry
						</Button>
					</div>
				) : (
					<div className="space-y-2.5">
						{registries.map((registry) => (
							<div
								key={registry.id}
								className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/30 p-4"
							>
								<div className="min-w-0 space-y-1">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-semibold text-foreground break-all">{registry.name}</span>
										<Badge variant="outline" className="text-[10px] font-mono">
											{registry.url}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground font-mono break-all">
										{registry.username} · {registry.hasPassword ? "credentials stored" : "no password"}
									</p>
								</div>
								<div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
									<Button
										variant="ghost"
										size="icon"
										title="Edit registry"
										className="h-8 w-8 text-muted-foreground hover:text-primary"
										onClick={() => openEdit(registry)}
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										title="Delete registry"
										className="h-8 w-8 text-muted-foreground hover:text-destructive"
										disabled={deletingId === registry.id}
										onClick={() => handleDelete(registry.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}
						<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
							<CheckCircle className="h-3 w-3 text-emerald-400" />
							Registries are available in project build settings and the create wizard.
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
