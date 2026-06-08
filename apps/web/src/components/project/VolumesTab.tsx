import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../../api/client";
import {
	useDeployments,
	useRedeployDeployment,
} from "../../hooks/useDeployments";
import { Card, CardContent } from "../ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
	HardDrive,
	Trash2,
	Plus,
	RefreshCw,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../ui/dialog";

interface VolumesTabProps {
	projectId: string;
}

export function VolumesTab({
	projectId,
}: VolumesTabProps) {
	const { data: volumes = [], refetch } =
		useQuery({
			queryKey: ["volumes", projectId],
			queryFn: () =>
				api.listVolumes(projectId),
		});

	const { data: deploymentsData } =
		useDeployments(projectId, 0, 5);
	const redeploy = useRedeployDeployment();
	const latestDeployment =
		deploymentsData?.items?.[0];
	const [isAddOpen, setIsAddOpen] =
		useState(false);
	const [deletingVolId, setDeletingVolId] =
		useState<string | null>(null);
	const [
		showRedeployPrompt,
		setShowRedeployPrompt,
	] = useState(false);
	const [mountPath, setMountPath] =
		useState("/app/data");
	const [isAdding, setIsAdding] =
		useState(false);

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!mountPath.trim()) return;
		setIsAdding(true);
		try {
			await api.createVolume(
				projectId,
				mountPath.trim(),
			);
			setMountPath("/app/data");
			setIsAddOpen(false);
			setShowRedeployPrompt(true);
			refetch();
		} finally {
			setIsAdding(false);
		}
	};

	const handleDeleteVolume = async () => {
		if (!deletingVolId) return;
		await api.deleteVolume(deletingVolId);
		setDeletingVolId(null);
		setShowRedeployPrompt(true);
		refetch();
	};

	const selectedVolToDelete = volumes.find(
		(v) => v.id === deletingVolId,
	);

	return (
		<div className="space-y-6">
			{/* Redeployment Warning Banner */}
			{showRedeployPrompt &&
				latestDeployment && (
					<div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 gap-3 animate-in fade-in-0 duration-200">
						<div className="flex items-start gap-3">
							<div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/15">
								<RefreshCw
									className={`h-4 w-4 ${redeploy.isPending ? "animate-spin" : ""}`}
								/>
							</div>
							<div>
								<h4 className="text-sm font-semibold text-foreground">
									Redeployment
									Required
								</h4>
								<p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
									You have added
									or deleted
									persistent
									volumes.
									Redeploy your
									application
									instances to
									mount these
									storage
									pathways.
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									setShowRedeployPrompt(
										false,
									)
								}
								className="text-xs h-8 px-3 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
								disabled={
									redeploy.isPending
								}
							>
								Dismiss
							</Button>
							<Button
								size="sm"
								onClick={async () => {
									try {
										await redeploy.mutateAsync(
											latestDeployment.id,
										);
										setShowRedeployPrompt(
											false,
										);
									} catch (err) {
										console.error(
											"Failed to redeploy",
											err,
										);
									}
								}}
								disabled={
									redeploy.isPending
								}
								className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-xs h-8 px-4 rounded-lg shadow-md hover:shadow-primary/10 transition-all flex items-center gap-1.5"
							>
								{redeploy.isPending ? (
									<>
										<RefreshCw className="h-3.5 w-3.5 animate-spin" />
										Redeploying...
									</>
								) : (
									<>
										<RefreshCw className="h-3.5 w-3.5" />
										Redeploy
										Now
									</>
								)}
							</Button>
						</div>
					</div>
				)}

			{volumes.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-12 text-center bg-card/20 backdrop-blur-sm relative overflow-hidden group min-h-[350px]">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
					<div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1a1a1f] to-[#121215] border border-border flex items-center justify-center mb-6 shadow-xl group-hover:border-primary/30 transition-colors duration-300">
						<div className="absolute inset-0 bg-primary/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
						<HardDrive className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
					</div>
					<h3 className="text-lg font-semibold text-foreground mb-2">
						No Persistent Volumes
					</h3>
					<p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
						Attach persistent disk
						pathways to your project.
						Mounted pathways preserve
						data across scaling
						actions, container
						updates, and restarts.
					</p>
					<Button
						onClick={() =>
							setIsAddOpen(true)
						}
						className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-5 h-10 rounded-xl transition-all shadow-lg hover:shadow-primary/20"
					>
						<Plus className="h-4 w-4" />{" "}
						Add Volume
					</Button>
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								Persistent Volumes
							</h2>
							<p className="text-sm text-muted-foreground">
								Disk volumes
								mounted to
								container
								runtimes.
							</p>
						</div>
						<Button
							onClick={() =>
								setIsAddOpen(true)
							}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs shadow-md"
						>
							<Plus className="h-4.5 w-4.5" />{" "}
							Add Volume
						</Button>
					</div>

					<div className="rounded-xl border border-border bg-card/35 backdrop-blur-sm overflow-hidden">
						<Table>
							<TableHeader className="bg-[#0b0b0f]/50">
								<TableRow className="border-border hover:bg-transparent">
									<TableHead className="text-xs font-semibold py-3">
										Mount Path
									</TableHead>
									<TableHead className="text-xs font-semibold py-3">
										Docker
										Volume
										Name
									</TableHead>
									<TableHead className="text-xs font-semibold py-3">
										Created
									</TableHead>
									<TableHead className="w-12 text-right pr-6"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{volumes.map(
									(v) => (
										<TableRow
											key={
												v.id
											}
											className="border-border hover:bg-[#121217]/30 group transition-all"
										>
											<TableCell className="font-mono text-sm py-3.5 font-semibold text-foreground">
												{
													v.mountPath
												}
											</TableCell>
											<TableCell className="font-mono text-xs py-3.5 text-muted-foreground/75">
												{v.dockerVolumeName ??
													"—"}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs py-3.5">
												{new Date(
													v.createdAt,
												).toLocaleDateString(
													undefined,
													{
														year: "numeric",
														month: "short",
														day: "numeric",
													},
												)}
											</TableCell>
											<TableCell className="py-3.5 pr-6 text-right">
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-80 group-hover:opacity-100"
													onClick={() =>
														setDeletingVolId(
															v.id,
														)
													}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</TableCell>
										</TableRow>
									),
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			)}

			{/* Add Volume Dialog */}
			<Dialog
				open={isAddOpen}
				onOpenChange={setIsAddOpen}
			>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Add Persistent Volume
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Define a persistent
							path inside your
							container.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={add}
						className="space-y-4 pt-2"
					>
						<div className="grid gap-2">
							<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Mount Path (inside
								container)
							</label>
							<Input
								placeholder="e.g. /app/data"
								value={mountPath}
								onChange={(e) =>
									setMountPath(
										e.target
											.value,
									)
								}
								className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg font-mono"
								required
							/>
						</div>

						<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
							<Button
								type="button"
								variant="ghost"
								onClick={() =>
									setIsAddOpen(
										false,
									)
								}
								className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
								disabled={
									isAdding
								}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={
									isAdding
								}
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all"
							>
								{isAdding
									? "Mounting..."
									: "Add Volume"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Delete Volume Confirmation Dialog */}
			<Dialog
				open={deletingVolId !== null}
				onOpenChange={(open) =>
					!open &&
					setDeletingVolId(null)
				}
			>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Unmount Volume
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Are you sure you want
							to unmount volume{" "}
							<span className="font-semibold text-foreground font-mono">
								{
									selectedVolToDelete?.mountPath
								}
							</span>
							? This will break
							connection to storage
							inside container
							deployments. Raw data
							remains on cluster
							node volumes but is
							unlinked.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() =>
								setDeletingVolId(
									null,
								)
							}
							className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							onClick={
								handleDeleteVolume
							}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs h-9 px-4 rounded-lg transition-all"
						>
							Unmount Volume
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
