import { Clock, Cpu, HardDrive, Network, Save, ShieldAlert, Zap } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import type { Database } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface DatabaseSettingsFormProps {
	database: Database;
	onRefetch: () => void;
}

export function DatabaseSettingsForm({ database, onRefetch }: DatabaseSettingsFormProps) {
	const [name, setName] = useState(database.name || "");
	const [cpu, setCpu] = useState(String(database.cpuLimit || 1));
	const [memory, setMemory] = useState(String(database.memoryLimitMb || 512));
	const [storage, setStorage] = useState(String(database.storageLimitMb || 10240));
	const [allowAnywhere, setAllowAnywhere] = useState(database.allowPublicAccessFromAnywhere || false);
	const [cidrs, setCidrs] = useState(database.allowedCidrs?.join(", ") || "");

	const [backupEnabled, setBackupEnabled] = useState(database.backupEnabled ?? true);
	const [backupSchedule, setBackupSchedule] = useState(database.backupSchedule ?? "0 */6 * * *");
	const [backupRetention, setBackupRetention] = useState(String(database.backupRetention ?? 7));

	const [isSaving, setIsSaving] = useState(false);
	const [successMsg, setSuccessMsg] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const handleSave = async () => {
		setIsSaving(true);
		setSuccessMsg(false);
		setErrorMsg(null);
		try {
			await api.updateDatabaseSettings(database.id, {
				name,
				cpuLimit: Number(cpu),
				memoryLimitMb: Number(memory),
				storageLimitMb: Number(storage),
				allowPublicAccessFromAnywhere: allowAnywhere,
				allowedCidrs: cidrs
					.split(/[\n,]/)
					.map((v) => v.trim())
					.filter(Boolean),
				backupEnabled,
				backupSchedule,
				backupRetention: Number(backupRetention),
			});
			setSuccessMsg(true);
			setTimeout(() => setSuccessMsg(false), 3500);
			onRefetch();
		} catch (err: any) {
			setErrorMsg(err.message || "Failed to save database configuration settings");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			{errorMsg && (
				<div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
					<ShieldAlert className="h-4 w-4 shrink-0" />
					<span>{errorMsg}</span>
				</div>
			)}

			{/* Card 1: Instance General Config */}
			<Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl p-6 space-y-6">
				<CardHeader className="p-0 border-b border-border/40 pb-4 flex flex-row items-center justify-between">
					<div>
						<CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
							<HardDrive className="h-4 w-4 text-orange-500" /> Instance General Identity
						</CardTitle>
						<CardDescription className="text-xs text-muted-foreground mt-1">
							Update display name and view engine details for this database instance.
						</CardDescription>
					</div>
					<Badge variant="outline" className="border-orange-500/30 text-orange-400 font-mono text-[10px] uppercase">
						{database.type}
					</Badge>
				</CardHeader>

				<CardContent className="p-0 space-y-4">
					<div className="space-y-2">
						<label htmlFor="edit-db-name" className="text-xs font-semibold text-foreground">
							Database Display Name
						</label>
						<Input
							id="edit-db-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="bg-background/50 border-border/80 text-xs rounded-xl h-10"
						/>
					</div>
				</CardContent>
			</Card>

			{/* Card 2: Resource Allocations */}
			<Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl p-6 space-y-6">
				<CardHeader className="p-0 border-b border-border/40 pb-4">
					<CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
						<Cpu className="h-4 w-4 text-orange-500" /> Compute & Storage Quotas
					</CardTitle>
					<CardDescription className="text-xs text-muted-foreground mt-1">
						Scale CPU cores, RAM limits, and persistent disk volume capacity.
					</CardDescription>
				</CardHeader>

				<CardContent className="p-0 space-y-6">
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
						{/* CPU Cores */}
						<div className="space-y-2">
							<label htmlFor="edit-db-cpu" className="text-xs font-medium text-muted-foreground block">
								CPU Cores Limit
							</label>
							<Input
								id="edit-db-cpu"
								type="number"
								step="0.5"
								value={cpu}
								onChange={(e) => setCpu(e.target.value)}
								className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
							/>
							<div className="flex gap-1.5 pt-1">
								{["0.5", "1", "2", "4"].map((val) => (
									<button
										key={val}
										type="button"
										onClick={() => setCpu(val)}
										className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
											cpu === val
												? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
												: "border-border/60 text-muted-foreground hover:bg-white/5"
										}`}
									>
										{val} Core
									</button>
								))}
							</div>
						</div>

						{/* RAM MB */}
						<div className="space-y-2">
							<label htmlFor="edit-db-memory" className="text-xs font-medium text-muted-foreground block">
								RAM Memory Limit (MB)
							</label>
							<Input
								id="edit-db-memory"
								type="number"
								step="128"
								value={memory}
								onChange={(e) => setMemory(e.target.value)}
								className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
							/>
							<div className="flex gap-1.5 pt-1">
								{[
									{ label: "512M", val: "512" },
									{ label: "1G", val: "1024" },
									{ label: "2G", val: "2048" },
									{ label: "4G", val: "4096" },
								].map((item) => (
									<button
										key={item.val}
										type="button"
										onClick={() => setMemory(item.val)}
										className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
											memory === item.val
												? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
												: "border-border/60 text-muted-foreground hover:bg-white/5"
										}`}
									>
										{item.label}
									</button>
								))}
							</div>
						</div>

						{/* Storage Quota */}
						<div className="space-y-2">
							<label htmlFor="edit-db-storage" className="text-xs font-medium text-muted-foreground block">
								Storage Quota (MB)
							</label>
							<Input
								id="edit-db-storage"
								type="number"
								step="1024"
								value={storage}
								onChange={(e) => setStorage(e.target.value)}
								className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
							/>
							<div className="flex gap-1.5 pt-1">
								{[
									{ label: "5G", val: "5120" },
									{ label: "10G", val: "10240" },
									{ label: "20G", val: "20480" },
									{ label: "50G", val: "51200" },
								].map((item) => (
									<button
										key={item.val}
										type="button"
										onClick={() => setStorage(item.val)}
										className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
											storage === item.val
												? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
												: "border-border/60 text-muted-foreground hover:bg-white/5"
										}`}
									>
										{item.label}
									</button>
								))}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Card 3: Network Security */}
			<Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl p-6 space-y-6">
				<CardHeader className="p-0 border-b border-border/40 pb-4">
					<CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
						<Network className="h-4 w-4 text-orange-500" /> Network Security & IP Whitelisting
					</CardTitle>
					<CardDescription className="text-xs text-muted-foreground mt-1">
						Control external access and allowed IP ranges. Internal container mesh access is always active.
					</CardDescription>
				</CardHeader>

				<CardContent className="p-0 space-y-4">
					<div className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-black/20">
						<div>
							<p className="text-xs font-semibold text-foreground">Allow Public Access from Anywhere (`0.0.0.0/0`)</p>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Expose port externally for direct client connection outside Dequel network.
							</p>
						</div>
						<input
							type="checkbox"
							checked={allowAnywhere}
							onChange={(e) => setAllowAnywhere(e.target.checked)}
							className="h-4 w-4 accent-orange-500 rounded"
						/>
					</div>

					{!allowAnywhere && (
						<div className="space-y-2">
							<label htmlFor="edit-db-cidrs" className="text-xs font-medium text-foreground block">
								Allowed IP Addresses / CIDRs (comma or newline separated)
							</label>
							<textarea
								id="edit-db-cidrs"
								value={cidrs}
								onChange={(e) => setCidrs(e.target.value)}
								placeholder="e.g. 192.168.1.50/32, 10.0.0.0/16"
								rows={2}
								className="w-full bg-background/50 border border-border/80 font-mono text-xs text-foreground p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500"
							/>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Card 4: Automated Backups Schedule */}
			<Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl p-6 space-y-6">
				<CardHeader className="p-0 border-b border-border/40 pb-4">
					<CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
						<Clock className="h-4 w-4 text-orange-500" /> Automated Snapshot Backups Schedule
					</CardTitle>
					<CardDescription className="text-xs text-muted-foreground mt-1">
						Automate snapshot dumps and define retention rules for this instance.
					</CardDescription>
				</CardHeader>

				<CardContent className="p-0 space-y-4">
					<div className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-black/20">
						<div>
							<p className="text-xs font-semibold text-foreground">Enable Scheduled Backups</p>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Automate periodic snapshot dumps for this instance.
							</p>
						</div>
						<input
							type="checkbox"
							checked={backupEnabled}
							onChange={(e) => setBackupEnabled(e.target.checked)}
							className="h-4 w-4 accent-orange-500 rounded"
						/>
					</div>

					{backupEnabled && (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
							<div className="space-y-2">
								<label htmlFor="edit-db-backup-schedule" className="text-xs font-medium text-foreground block">
									Cron Expression (`BACKUP_SCHEDULE`)
								</label>
								<Input
									id="edit-db-backup-schedule"
									value={backupSchedule}
									onChange={(e) => setBackupSchedule(e.target.value)}
									placeholder="0 */6 * * *"
									className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
								/>
								<div className="flex gap-1.5 pt-1">
									{[
										{ label: "Every 6h", val: "0 */6 * * *" },
										{ label: "Every 12h", val: "0 */12 * * *" },
										{ label: "Daily 00:00", val: "0 0 * * *" },
									].map((item) => (
										<button
											key={item.val}
											type="button"
											onClick={() => setBackupSchedule(item.val)}
											className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
												backupSchedule === item.val
													? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
													: "border-border/60 text-muted-foreground hover:bg-white/5"
											}`}
										>
											{item.label}
										</button>
									))}
								</div>
							</div>

							<div className="space-y-2">
								<label htmlFor="edit-db-backup-retention" className="text-xs font-medium text-foreground block">
									Retention Count (`BACKUP_RETENTION`)
								</label>
								<Input
									id="edit-db-backup-retention"
									type="number"
									min="1"
									max="30"
									value={backupRetention}
									onChange={(e) => setBackupRetention(e.target.value)}
									className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
								/>
								<span className="text-[10px] text-muted-foreground block">
									Number of latest snapshots kept per target.
								</span>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Save Actions Bar */}
			<div className="flex items-center justify-between pt-2">
				{successMsg ? (
					<p role="status" className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
						<Zap className="h-4 w-4" /> Settings updated successfully!
					</p>
				) : (
					<span />
				)}

				<Button
					onClick={handleSave}
					disabled={isSaving}
					className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs px-6 rounded-xl h-10 shadow-md gap-2"
				>
					<Save className="h-4 w-4" />
					{isSaving ? "Saving..." : "Save Settings"}
				</Button>
			</div>
		</div>
	);
}
