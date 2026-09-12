import { useQuery } from "@tanstack/react-query";
import {
	Clock,
	Cloud,
	Database,
	Download,
	HardDrive,
	RefreshCw,
	Save,
	ShieldAlert,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import type { BackupJob, BackupStorageSettingsData } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export function BackupSettingsSection() {
	const [storageType, setStorageType] = useState<"local" | "s3">("local");
	const [path, setPath] = useState("/data/backups");
	const [s3Endpoint, setS3Endpoint] = useState("");
	const [s3AccessKeyId, setS3AccessKeyId] = useState("");
	const [s3SecretAccessKey, setS3SecretAccessKey] = useState("");
	const [s3Bucket, setS3Bucket] = useState("");
	const [s3Region, setS3Region] = useState("auto");
	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const [isTriggering, setIsTriggering] = useState(false);
	const [restoringBackup, setRestoringBackup] = useState<BackupJob | null>(null);
	const [isRestoring, setIsRestoring] = useState(false);
	const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
	const [deletingBackup, setDeletingBackup] = useState<BackupJob | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const { data: config, refetch: refetchConfig } = useQuery({
		queryKey: ["backup-storage-settings"],
		queryFn: async () => {
			const res = await api.getBackupStorageSettings();
			if (res) {
				setStorageType(res.type || "local");
				setPath(res.path || "/data/backups");
				setS3Endpoint(res.s3Endpoint || "");
				setS3AccessKeyId(res.s3AccessKeyId || "");
				setS3SecretAccessKey(res.s3SecretAccessKey || "");
				setS3Bucket(res.s3Bucket || "");
				setS3Region(res.s3Region || "auto");
			}
			return res;
		},
	});

	const { data: backups = [], refetch: refetchBackups } = useQuery({
		queryKey: ["backups"],
		queryFn: () => api.listBackups().catch(() => []),
		refetchInterval: 10_000,
	});

	const handleSaveConfig = async () => {
		setIsSaving(true);
		setSaveError(null);
		setSaveSuccess(false);
		try {
			await api.updateBackupStorageSettings({
				type: storageType,
				path,
				s3Endpoint,
				s3AccessKeyId,
				s3SecretAccessKey,
				s3Bucket,
				s3Region,
			});
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
			refetchConfig();
		} catch (err: any) {
			setSaveError(err.message || "Failed to save backup storage settings");
		} finally {
			setIsSaving(false);
		}
	};

	const handleTriggerSystemBackup = async () => {
		setIsTriggering(true);
		try {
			await api.triggerBackup("internal");
			refetchBackups();
		} catch (err: any) {
			setSaveError(err.message || "Failed to trigger system backup");
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
			setRestoreMessage("Backup successfully restored.");
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
			refetchBackups();
		} catch (err: any) {
			setSaveError(err.message || "Failed to delete backup");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Storage Provider Settings Card */}
			<Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden">
				<CardHeader className="border-b border-border/40 pb-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
								<Cloud className="h-5 w-5" />
							</div>
							<div>
								<CardTitle className="text-base font-bold text-foreground">Global Backup Storage Location</CardTitle>
								<CardDescription className="text-xs text-muted-foreground">
									Configure destination storage targets for all automated and manual database backups.
								</CardDescription>
							</div>
						</div>
						<Badge variant="outline" className="border-orange-500/30 text-orange-400 font-mono text-[10px] uppercase">
							{storageType === "s3" ? "S3 / Cloudflare R2" : "Local Storage"}
						</Badge>
					</div>
				</CardHeader>

				<CardContent className="p-6 space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="space-y-2">
							<label htmlFor="backup-storage-type" className="text-xs font-semibold text-foreground">
								Storage Destination Type
							</label>
							<Select value={storageType} onValueChange={(val: "local" | "s3") => setStorageType(val)}>
								<SelectTrigger
									id="backup-storage-type"
									className="bg-background/50 border-border/80 text-xs rounded-xl h-10"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-card border-border text-xs">
									<SelectItem value="local">Local Filesystem Path</SelectItem>
									<SelectItem value="s3">Amazon S3 / Cloudflare R2 Storage</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{storageType === "local" ? (
							<div className="space-y-2">
								<label htmlFor="backup-storage-path" className="text-xs font-semibold text-foreground">
									Local Volume Directory Path
								</label>
								<Input
									id="backup-storage-path"
									value={path}
									onChange={(e) => setPath(e.target.value)}
									placeholder="/data/backups"
									className="bg-background/50 border-border/80 text-xs font-mono rounded-xl h-10"
								/>
							</div>
						) : (
							<div className="space-y-2">
								<label htmlFor="s3-bucket" className="text-xs font-semibold text-foreground">
									Bucket Name
								</label>
								<Input
									id="s3-bucket"
									value={s3Bucket}
									onChange={(e) => setS3Bucket(e.target.value)}
									placeholder="my-dequel-backups"
									className="bg-background/50 border-border/80 text-xs font-mono rounded-xl h-10"
								/>
							</div>
						)}
					</div>

					{storageType === "s3" && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/40">
							<div className="space-y-2">
								<label htmlFor="s3-endpoint" className="text-xs font-semibold text-foreground">
									S3 Compatible Endpoint URL
								</label>
								<Input
									id="s3-endpoint"
									value={s3Endpoint}
									onChange={(e) => setS3Endpoint(e.target.value)}
									placeholder="https://xxx.r2.cloudflarestorage.com"
									className="bg-background/50 border-border/80 text-xs font-mono rounded-xl h-10"
								/>
							</div>

							<div className="space-y-2">
								<label htmlFor="s3-region" className="text-xs font-semibold text-foreground">
									Region
								</label>
								<Input
									id="s3-region"
									value={s3Region}
									onChange={(e) => setS3Region(e.target.value)}
									placeholder="auto"
									className="bg-background/50 border-border/80 text-xs font-mono rounded-xl h-10"
								/>
							</div>

							<div className="space-y-2">
								<label htmlFor="s3-access-key" className="text-xs font-semibold text-foreground">
									Access Key ID
								</label>
								<Input
									id="s3-access-key"
									value={s3AccessKeyId}
									onChange={(e) => setS3AccessKeyId(e.target.value)}
									placeholder="AKIAIOSFODNN7EXAMPLE"
									className="bg-background/50 border-border/80 text-xs font-mono rounded-xl h-10"
								/>
							</div>

							<div className="space-y-2">
								<label htmlFor="s3-secret-key" className="text-xs font-semibold text-foreground">
									Secret Access Key
								</label>
								<Input
									id="s3-secret-key"
									type="password"
									value={s3SecretAccessKey}
									onChange={(e) => setS3SecretAccessKey(e.target.value)}
									placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
									className="bg-background/50 border-border/80 text-xs font-mono rounded-xl h-10"
								/>
							</div>
						</div>
					)}

					{saveError && (
						<p role="alert" className="text-xs text-red-400 flex items-center gap-1.5">
							<ShieldAlert className="h-4 w-4" />
							{saveError}
						</p>
					)}

					{saveSuccess && (
						<p role="status" className="text-xs text-emerald-400 flex items-center gap-1.5">
							<ShieldCheck className="h-4 w-4" />
							Backup storage settings saved successfully!
						</p>
					)}

					<div className="flex justify-end pt-2">
						<Button
							onClick={handleSaveConfig}
							disabled={isSaving}
							className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs px-6 rounded-xl h-10 shadow-md gap-2"
						>
							<Save className="h-4 w-4" />
							{isSaving ? "Saving..." : "Save Backup Storage Settings"}
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* System DB Backups Card */}
			<Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden">
				<CardHeader className="border-b border-border/40 pb-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
								<Database className="h-5 w-5" />
							</div>
							<div>
								<CardTitle className="text-base font-bold text-foreground">System Database & Backups</CardTitle>
								<CardDescription className="text-xs text-muted-foreground">
									Manage backups for Dequel&apos;s internal orchestrator database and target managed services.
								</CardDescription>
							</div>
						</div>

						<Button
							onClick={handleTriggerSystemBackup}
							disabled={isTriggering}
							size="sm"
							className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl h-10 px-5 gap-2"
						>
							<RefreshCw className={`h-4 w-4 ${isTriggering ? "animate-spin" : ""}`} />
							{isTriggering ? "Backing up..." : "Backup System Database Now"}
						</Button>
					</div>
				</CardHeader>

				<CardContent className="p-6 space-y-4">
					<div className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
						Backup History ({backups.length})
					</div>

					{backups.length === 0 ? (
						<div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-black/20 p-6 text-center">
							<Clock className="h-6 w-6 text-muted-foreground mb-2" />
							<p className="text-xs text-muted-foreground">No backups found.</p>
						</div>
					) : (
						<div className="divide-y divide-border/40 border border-border/60 rounded-2xl bg-black/20 overflow-hidden">
							{backups.map((job) => (
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
											<span>
												Target: {job.targetId} ({job.engine})
											</span>
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

			{/* Restore Confirmation Dialog */}
			<Dialog open={!!restoringBackup} onOpenChange={(open) => !open && setRestoringBackup(null)}>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Restore Database Backup</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
							Are you sure you want to restore backup{" "}
							<strong>{restoringBackup?.filename || restoringBackup?.id}</strong>? This will overwrite the target
							database standard tables.
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
							{isRestoring ? "Restoring..." : "Confirm & Restore"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Backup Dialog */}
			<Dialog open={!!deletingBackup} onOpenChange={(open) => !open && setDeletingBackup(null)}>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Delete Backup Record</DialogTitle>
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
