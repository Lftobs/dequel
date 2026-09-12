import { useQuery } from "@tanstack/react-query";
import { Clock, Download, HardDrive, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import type { BackupJob, Database } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

interface DatabaseBackupManagerProps {
	database: Database;
}

export function DatabaseBackupManager({ database }: DatabaseBackupManagerProps) {
	const [isTriggering, setIsTriggering] = useState(false);
	const [restoringBackup, setRestoringBackup] = useState<BackupJob | null>(null);
	const [isRestoring, setIsRestoring] = useState(false);
	const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
	const [deletingBackup, setDeletingBackup] = useState<BackupJob | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { data: allBackups = [], refetch } = useQuery({
		queryKey: ["backups"],
		queryFn: () => api.listBackups().catch(() => []),
		refetchInterval: 10_000,
	});

	const instanceBackups = allBackups.filter((b) => b.targetId === database.id);

	const handleTriggerBackup = async () => {
		setIsTriggering(true);
		setError(null);
		try {
			await api.triggerBackup(database.id);
			refetch();
		} catch (err: any) {
			setError(err.message || "Failed to trigger instance backup");
		} finally {
			setIsTriggering(false);
		}
	};

	const handleRestore = async () => {
		if (!restoringBackup) return;
		setIsRestoring(true);
		setRestoreMessage(null);
		try {
			await api.restoreBackup(restoringBackup.id);
			setRestoreMessage("Instance database dump restored successfully.");
			setTimeout(() => {
				setRestoringBackup(null);
				setRestoreMessage(null);
			}, 2000);
		} catch (err: any) {
			setRestoreMessage(`Restore failed: ${err.message}`);
		} finally {
			setIsRestoring(false);
		}
	};

	const handleDeleteBackup = async () => {
		if (!deletingBackup) return;
		setIsDeleting(true);
		try {
			await api.deleteBackup(deletingBackup.id);
			setDeletingBackup(null);
			refetch();
		} catch (err: any) {
			setError(err.message || "Failed to delete backup");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="space-y-6">
			<Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden">
				<CardHeader className="border-b border-border/40 pb-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
								<HardDrive className="h-5 w-5" />
							</div>
							<div>
								<CardTitle className="text-base font-bold text-foreground">
									Instance Backups for {database.name}
								</CardTitle>
								<CardDescription className="text-xs text-muted-foreground">
									Trigger on-demand backups or restore previous snapshots for this database.
								</CardDescription>
							</div>
						</div>

						<Button
							onClick={handleTriggerBackup}
							disabled={isTriggering || database.status !== "running"}
							size="sm"
							className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs rounded-xl h-10 px-5 gap-2 shadow-md"
						>
							<RefreshCw className={`h-4 w-4 ${isTriggering ? "animate-spin" : ""}`} />
							{isTriggering ? "Dumping..." : "Take Backup Now"}
						</Button>
					</div>
				</CardHeader>

				<CardContent className="p-6 space-y-4">
					{error && (
						<div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
							<ShieldAlert className="h-4 w-4" />
							{error}
						</div>
					)}

					<div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						<span>Snapshots ({instanceBackups.length})</span>
						<span className="font-mono text-[11px] text-muted-foreground">
							Schedule: {database.backupEnabled ? database.backupSchedule : "Disabled"}
						</span>
					</div>

					{instanceBackups.length === 0 ? (
						<div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-black/20 p-6 text-center">
							<Clock className="h-6 w-6 text-muted-foreground mb-2" />
							<p className="text-xs text-muted-foreground">No backup snapshots found for this instance.</p>
						</div>
					) : (
						<div className="divide-y divide-border/40 border border-border/60 rounded-2xl bg-black/20 overflow-hidden">
							{instanceBackups.map((job) => (
								<div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<span className="text-xs font-mono font-semibold text-foreground">{job.filename || job.id}</span>
											<Badge
												variant="outline"
												className={`text-[10px] uppercase font-mono px-2 py-0.5 ${
													job.status === "completed"
														? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
														: job.status === "failed"
															? "border-red-500/30 text-red-400 bg-red-500/10"
															: "border-amber-500/30 text-amber-400 bg-amber-500/10"
												}`}
											>
												{job.status}
											</Badge>
										</div>
										<div className="flex items-center gap-4 text-[11px] text-muted-foreground font-mono">
											<span>Storage: {job.storageType}</span>
											<span>{job.sizeBytes ? `${(job.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : "Pending"}</span>
											<span>{new Date(job.createdAt).toLocaleString()}</span>
										</div>
									</div>

									<div className="flex items-center gap-2">
										{job.status === "completed" && (
											<Button
												size="sm"
												variant="outline"
												onClick={() => setRestoringBackup(job)}
												className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-xs h-8 px-3 rounded-lg"
											>
												Restore
											</Button>
										)}
										<Button
											size="sm"
											variant="ghost"
											onClick={() => setDeletingBackup(job)}
											className="text-red-400 hover:bg-red-500/10 text-xs h-8 px-2.5 rounded-lg"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Restore Modal */}
			<Dialog open={!!restoringBackup} onOpenChange={(open) => !open && setRestoringBackup(null)}>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Restore Database Snapshot</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
							Are you sure you want to restore <strong>{restoringBackup?.filename || restoringBackup?.id}</strong> to{" "}
							<strong>{database.name}</strong>? Current table data will be overwritten.
						</DialogDescription>
					</DialogHeader>

					{restoreMessage && (
						<p role="status" className="text-xs text-orange-400">
							{restoreMessage}
						</p>
					)}

					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							disabled={isRestoring}
							onClick={() => setRestoringBackup(null)}
							className="h-9 text-xs"
						>
							Cancel
						</Button>
						<Button
							disabled={isRestoring}
							onClick={handleRestore}
							className="bg-orange-500 hover:bg-orange-600 text-white font-semibold h-9 text-xs px-5 rounded-xl shadow-lg"
						>
							{isRestoring ? "Restoring..." : "Restore Snapshot"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Modal */}
			<Dialog open={!!deletingBackup} onOpenChange={(open) => !open && setDeletingBackup(null)}>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Delete Backup</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Permanently remove backup file <strong>{deletingBackup?.filename || deletingBackup?.id}</strong>?
						</DialogDescription>
					</DialogHeader>

					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							disabled={isDeleting}
							onClick={() => setDeletingBackup(null)}
							className="h-9 text-xs"
						>
							Cancel
						</Button>
						<Button
							disabled={isDeleting}
							onClick={handleDeleteBackup}
							className="bg-destructive text-destructive-foreground font-semibold h-9 text-xs px-5 rounded-xl shadow-lg"
						>
							{isDeleting ? "Deleting..." : "Delete Permanently"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
