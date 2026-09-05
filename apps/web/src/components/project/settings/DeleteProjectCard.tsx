import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteProject, useProject } from "../../../hooks/useProjects";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";

interface DeleteProjectCardProps {
	projectId: string;
}

export function DeleteProjectCard({ projectId }: DeleteProjectCardProps) {
	const { data: project } = useProject(projectId);
	const deleteProject = useDeleteProject();
	const navigate = useNavigate();

	const [open, setOpen] = useState(false);
	const [confirmNameInput, setConfirmNameInput] = useState("");
	const [deleteError, setDeleteError] = useState<string | null>(null);

	if (!project) return null;

	const handleDelete = async () => {
		setDeleteError(null);
		try {
			await deleteProject.mutateAsync(projectId);
			setOpen(false);
			navigate({ to: "/" });
		} catch (err) {
			setDeleteError(err instanceof Error ? err.message : "Failed to delete project");
		}
	};

	const openDeleteModal = () => {
		setConfirmNameInput("");
		setDeleteError(null);
		setOpen(true);
	};

	return (
		<Card className="bg-[#0c0c0e]/60 border-red-500/20 rounded-xl overflow-hidden">
			<CardContent className="p-6 space-y-4">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#222227] pb-5 space-y-4">
					<div className="flex items-start gap-3">
						<div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
							<Trash2 className="h-4 w-4" />
						</div>
						<div>
							<h3 className="text-zinc-200 font-bold text-base">Danger Zone</h3>
							<p className="text-zinc-500 text-xs mt-1">
								Permanently delete this project and all associated containers, volumes, databases, routes, and
								deployment history.
							</p>
						</div>
					</div>
					<Button
						variant="destructive"
						onClick={openDeleteModal}
						className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
					>
						<Trash2 className="h-3.5 w-3.5" />
						Delete Project
					</Button>
				</div>

				<Dialog
					open={open}
					onOpenChange={(v) => {
						if (!v) setOpen(false);
					}}
				>
					<DialogContent className="sm:max-w-[440px] bg-[#0c0c10] border-red-500/30 text-foreground rounded-2xl shadow-2xl p-5">
						<DialogHeader className="space-y-2">
							<div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto sm:mx-0">
								<AlertTriangle className="h-5 w-5" />
							</div>
							<DialogTitle className="text-lg font-bold text-foreground">
								Delete Project &ldquo;{project.name}&rdquo;?
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground leading-relaxed">
								This action is <strong className="text-red-400">permanent and irreversible</strong>. Deleting this
								project will stop and remove all associated Docker containers, volumes, database instances, custom
								routes, and deployment history.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-3 py-2">
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									To confirm, please type <strong className="text-foreground select-all">{project.name}</strong> below:
								</label>
								<Input
									placeholder={project.name}
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
								onClick={() => setOpen(false)}
								disabled={deleteProject.isPending}
								className="h-9 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								onClick={handleDelete}
								disabled={deleteProject.isPending || confirmNameInput.trim() !== project.name}
								className="bg-red-600 hover:bg-red-700 text-white font-semibold h-9 text-xs px-5 rounded-xl shadow-lg transition-all"
							>
								{deleteProject.isPending ? "Deleting..." : "I understand, delete project"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}
