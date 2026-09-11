import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Trash2, AlertTriangle, Search, FolderX, Globe, GitBranch } from "lucide-react";
import * as api from "../../api/client";
import type { Project } from "../../types";

export function DeleteProjectsSection() {
	const queryClient = useQueryClient();
	const {
		data: projects = [],
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["projects"],
		queryFn: () => api.listProjects().catch(() => []),
	});

	const [searchQuery, setSearchQuery] = useState("");
	const [deletingProject, setDeletingProject] = useState<Project | null>(null);
	const [confirmNameInput, setConfirmNameInput] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

	const filteredProjects = useMemo(() => {
		if (!searchQuery.trim()) return projects;
		const q = searchQuery.toLowerCase();
		return projects.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				(p.repoUrl && p.repoUrl.toLowerCase().includes(q)) ||
				(p.baseDomain && p.baseDomain.toLowerCase().includes(q)),
		);
	}, [projects, searchQuery]);

	const handleDelete = async () => {
		if (!deletingProject) return;
		setIsDeleting(true);
		setDeleteError(null);
		try {
			await api.deleteProject(deletingProject.id);
			const deletedName = deletingProject.name;
			setDeletingProject(null);
			setConfirmNameInput("");
			setDeleteSuccess(`Project "${deletedName}" and all associated resources have been deleted.`);
			queryClient.invalidateQueries({ queryKey: ["projects"] });
			refetch();
			setTimeout(() => setDeleteSuccess(null), 5000);
		} catch (err) {
			setDeleteError(err instanceof Error ? err.message : "Failed to delete project");
		} finally {
			setIsDeleting(false);
		}
	};

	const openDeleteModal = (project: Project) => {
		setDeletingProject(project);
		setConfirmNameInput("");
		setDeleteError(null);
	};

	return (
		<Card className="border-red-500/20 bg-card/60 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="flex items-center gap-2.5">
						<div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
							<Trash2 className="h-4 w-4" />
						</div>
						<div>
							<CardTitle className="text-base font-bold text-foreground">Delete Projects</CardTitle>
							<p className="text-xs text-muted-foreground mt-0.5">
								Permanently remove projects, containers, volumes, databases, routes, and custom domains.
							</p>
						</div>
					</div>
					{projects.length > 3 && (
						<div className="relative w-full sm:w-64">
							<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								placeholder="Search projects..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-8 pl-8 text-xs bg-background/50 border-border"
							/>
						</div>
					)}
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{deleteSuccess && (
					<div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in-50">
						<AlertTriangle className="h-4 w-4 shrink-0 text-emerald-400" />
						<span>{deleteSuccess}</span>
					</div>
				)}

				{isLoading ? (
					<div className="py-8 text-center text-xs text-muted-foreground">Loading projects...</div>
				) : projects.length === 0 ? (
					<div className="py-8 text-center rounded-xl border border-dashed border-border p-6 space-y-2">
						<FolderX className="h-8 w-8 text-muted-foreground/50 mx-auto" />
						<p className="text-xs font-medium text-muted-foreground">No projects found on this platform.</p>
					</div>
				) : filteredProjects.length === 0 ? (
					<div className="py-6 text-center text-xs text-muted-foreground">
						No projects matching &ldquo;{searchQuery}&rdquo;.
					</div>
				) : (
					<div className="rounded-xl border border-border/80 overflow-hidden overflow-x-auto bg-black/20">
						<Table className="min-w-[600px] md:min-w-full">
							<TableHeader>
								<TableRow className="border-border/60 hover:bg-transparent">
									<TableHead className="text-xs font-semibold">Project</TableHead>
									<TableHead className="text-xs font-semibold">Type / Source</TableHead>
									<TableHead className="text-xs font-semibold">Branch / Domain</TableHead>
									<TableHead className="text-xs font-semibold">Created</TableHead>
									<TableHead className="w-24 text-right"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredProjects.map((p) => (
									<TableRow key={p.id} className="border-border/40 hover:bg-white/[0.02]">
										<TableCell className="font-medium text-xs">
											<div className="space-y-0.5">
												<span className="font-bold text-foreground">{p.name}</span>
												{p.description && (
													<p className="text-[11px] text-muted-foreground line-clamp-1">{p.description}</p>
												)}
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1.5 flex-wrap">
												<Badge
													variant="outline"
													className="text-[10px] uppercase font-mono py-0 px-1.5 bg-muted/20 border-border"
												>
													{p.projectType || "web"}
												</Badge>
												{p.repoUrl ? (
													<span
														className="text-[11px] text-muted-foreground font-mono truncate max-w-[160px]"
														title={p.repoUrl}
													>
														{p.repoUrl.replace(/https?:\/\/github\.com\//, "")}
													</span>
												) : (
													<span className="text-[11px] text-muted-foreground">Upload / Archive</span>
												)}
											</div>
										</TableCell>
										<TableCell>
											<div className="space-y-0.5 text-xs">
												{p.repoBranch && (
													<div className="flex items-center gap-1 text-muted-foreground font-mono text-[11px]">
														<GitBranch className="h-3 w-3 text-muted-foreground/70" />
														<span>{p.repoBranch}</span>
													</div>
												)}
												{p.baseDomain && (
													<div className="flex items-center gap-1 text-muted-foreground font-mono text-[11px]">
														<Globe className="h-3 w-3 text-muted-foreground/70" />
														<span className="truncate max-w-[140px]">{p.baseDomain}</span>
													</div>
												)}
												{!p.repoBranch && !p.baseDomain && <span className="text-muted-foreground/60">—</span>}
											</div>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => openDeleteModal(p)}
												className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-colors flex items-center gap-1.5 ml-auto"
											>
												<Trash2 className="h-3.5 w-3.5" />
												<span>Delete</span>
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
				open={deletingProject !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingProject(null);
				}}
			>
				<DialogContent className="sm:max-w-[440px] bg-[#0c0c10] border-red-500/30 text-foreground rounded-2xl shadow-2xl p-5">
					<DialogHeader className="space-y-2">
						<div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto sm:mx-0">
							<AlertTriangle className="h-5 w-5" />
						</div>
						<DialogTitle className="text-lg font-bold text-foreground">
							Delete Project &ldquo;{deletingProject?.name}&rdquo;?
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground leading-relaxed">
							This action is <strong className="text-red-400">permanent and irreversible</strong>. Deleting this project
							will stop and remove all associated Docker containers, volumes, database instances, custom routes, and
							deployment history.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 py-2">
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								To confirm, please type <strong className="text-foreground select-all">{deletingProject?.name}</strong>{" "}
								below:
							</label>
							<Input
								placeholder={deletingProject?.name}
								value={confirmNameInput}
								onChange={(e) => setConfirmNameInput(e.target.value)}
								className="h-9 text-xs bg-background/60 border-border font-medium"
								autoFocus
							/>
						</div>

						{deleteError && (
							<p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
								{deleteError}
							</p>
						)}
					</div>

					<DialogFooter className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() => setDeletingProject(null)}
							disabled={isDeleting}
							className="h-9 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={isDeleting || confirmNameInput.trim() !== deletingProject?.name}
							className="bg-red-600 hover:bg-red-700 text-white font-semibold h-9 text-xs px-5 rounded-xl shadow-lg transition-all"
						>
							{isDeleting ? "Deleting..." : "I understand, delete project"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
