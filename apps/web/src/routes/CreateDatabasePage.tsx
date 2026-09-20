import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, Cpu, Database, HardDrive, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../api/client";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { DATABASE_ENGINES, DatabaseSelect } from "../components/ui/DatabaseSelect";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ServerSelect } from "../components/databases/ServerSelect";
import type { DatabaseType } from "../types";

export function CreateDatabasePage() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [projectId, setProjectId] = useState("standalone");
	const [type, setType] = useState<DatabaseType>("postgresql");
	const [version, setVersion] = useState("16");
	const [cpu, setCpu] = useState("1");
	const [memory, setMemory] = useState("512");
	const [storage, setStorage] = useState("10240");
	const [allowAnywhere, setAllowAnywhere] = useState(false);
	const [cidrs, setCidrs] = useState("");
	const [serverId, setServerId] = useState("local");

	const [backupEnabled, setBackupEnabled] = useState(true);
	const [backupSchedule, setBackupSchedule] = useState("0 */6 * * *");
	const [backupRetention, setBackupRetention] = useState("7");

	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { data: projects = [] } = useQuery({
		queryKey: ["projects"],
		queryFn: () => api.listProjects().catch(() => []),
	});

	const { data: servers = [] } = useQuery({
		queryKey: ["servers"],
		queryFn: () => api.listServers().catch(() => []),
	});

	useEffect(() => {
		const engine = DATABASE_ENGINES.find((item) => item.type === type);
		if (engine) setVersion(engine.defaultVersion);
	}, [type]);

	const handleCreate = async () => {
		setIsCreating(true);
		setError(null);
		try {
			const created = await api.createDatabase(projectId === "standalone" ? null : projectId, type, {
				name,
				version,
				serverId,
				cpuLimit: Number(cpu),
				memoryLimitMb: Number(memory),
				storageLimitMb: Number(storage),
				publicAccess: true,
				allowPublicAccessFromAnywhere: allowAnywhere,
				allowedCidrs: cidrs
					.split(/[\n,]/)
					.map((v) => v.trim())
					.filter(Boolean),
				backupEnabled,
				backupSchedule,
				backupRetention: Number(backupRetention),
			});

			navigate({ to: "/databases/$databaseId", params: { databaseId: created.id } });
		} catch (err: any) {
			setError(err.message || "Failed to provision database instance");
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<div className="mx-auto max-w-5xl space-y-8 pb-16">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="space-y-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate({ to: "/databases" })}
						className="text-xs text-muted-foreground hover:text-foreground gap-1.5 p-0 hover:bg-transparent"
					>
						<ArrowLeft className="h-4 w-4" /> Back to Databases
					</Button>
					<h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
						<Database className="h-7 w-7 text-orange-500" />
						Provision Managed Database
					</h1>
				</div>
				<Badge
					variant="outline"
					className="border-orange-500/30 bg-orange-500/10 text-orange-400 font-mono text-xs w-fit"
				>
					Zero-Config Data Engine
				</Badge>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Main Form Area */}
				<div className="lg:col-span-2 space-y-6">
					{/* Engine Selection */}
					<div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-md space-y-4 shadow-xl">
						<h2 className="text-sm font-bold text-foreground flex items-center gap-2">
							<Sparkles className="h-4 w-4 text-orange-400" />
							1. Database Engine & Version
						</h2>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							{DATABASE_ENGINES.map((engine) => {
								const isSelected = type === engine.type;
								return (
									<button
										key={engine.type}
										type="button"
										onClick={() => setType(engine.type as DatabaseType)}
										className={`flex flex-col items-start p-4 rounded-2xl border transition-all text-left ${
											isSelected
												? "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/50 shadow-lg"
												: "border-border/60 bg-background/30 hover:border-border"
										}`}
									>
										<div className="flex items-center justify-between w-full">
											<span className="font-bold text-xs text-foreground">{engine.label}</span>
											<Badge variant="outline" className="text-[10px] font-mono border-border/60">
												v{engine.defaultVersion}
											</Badge>
										</div>
										<p className="text-[11px] text-muted-foreground mt-1 leading-snug">{engine.description}</p>
									</button>
								);
							})}
						</div>

						<div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<label htmlFor="database-display-name" className="text-xs font-semibold text-foreground">
									Display Name
								</label>
								<Input
									id="database-display-name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g. Production PostgreSQL DB"
									className="bg-background/50 border-border/80 text-xs rounded-xl h-10"
								/>
							</div>

							<div className="space-y-1.5">
								<label htmlFor="database-version-tag" className="text-xs font-semibold text-foreground">
									Engine Version Tag
								</label>
								<Input
									id="database-version-tag"
									value={version}
									onChange={(e) => setVersion(e.target.value)}
									className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
								/>
							</div>
						</div>
					</div>

					{/* Project Attachment & Placement */}
					<div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-md space-y-4 shadow-xl">
						<h2 className="text-sm font-bold text-foreground">2. Environment Attachment</h2>
						<div className="space-y-1.5">
							<label htmlFor="database-project-attachment" className="text-xs font-semibold text-foreground">
								Target Project Attachment
							</label>
							<Select value={projectId} onValueChange={setProjectId}>
								<SelectTrigger
									id="database-project-attachment"
									className="bg-background/50 border-border/80 text-xs rounded-xl h-10"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-card border-border text-xs">
									<SelectItem value="standalone">Standalone Instance (No Project Link)</SelectItem>
									{projects.map((proj) => (
										<SelectItem key={proj.id} value={proj.id}>
											{proj.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<ServerSelect id="database-server" value={serverId} onChange={setServerId} servers={servers} />
					</div>

					{/* Resource Allocation */}
					<div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-md space-y-4 shadow-xl">
						<h2 className="text-sm font-bold text-foreground flex items-center gap-2">
							<Cpu className="h-4 w-4 text-orange-400" />
							3. Resource Limits & Quotas
						</h2>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div className="space-y-1.5">
								<label htmlFor="database-cpu-cores" className="text-xs font-medium text-muted-foreground">
									CPU Limit (Cores)
								</label>
								<Input
									id="database-cpu-cores"
									type="number"
									step="0.5"
									min="0.5"
									value={cpu}
									onChange={(e) => setCpu(e.target.value)}
									className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
								/>
							</div>
							<div className="space-y-1.5">
								<label htmlFor="database-memory-limit" className="text-xs font-medium text-muted-foreground">
									RAM Limit (MB)
								</label>
								<Input
									id="database-memory-limit"
									type="number"
									step="128"
									min="128"
									value={memory}
									onChange={(e) => setMemory(e.target.value)}
									className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
								/>
							</div>
							<div className="space-y-1.5">
								<label htmlFor="database-storage-quota" className="text-xs font-medium text-muted-foreground">
									Storage Quota (MB)
								</label>
								<Input
									id="database-storage-quota"
									type="number"
									step="1024"
									min="1024"
									value={storage}
									onChange={(e) => setStorage(e.target.value)}
									className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
								/>
							</div>
						</div>
					</div>

					{/* Network & Security */}
					<div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-md space-y-4 shadow-xl">
						<h2 className="text-sm font-bold text-foreground flex items-center gap-2">
							<HardDrive className="h-4 w-4 text-blue-400" />
							4. Network Access & CIDR Whitelist
						</h2>
						<div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/40 bg-black/20">
							<div>
								<p className="text-xs font-semibold text-foreground">Allow Connections From Anywhere</p>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									Uncheck to restrict connection access to explicit IP ranges.
								</p>
							</div>
							<input
								type="checkbox"
								checked={allowAnywhere}
								onChange={(e) => setAllowAnywhere(e.target.checked)}
								className="h-4 w-4 accent-orange-500 rounded"
								aria-label="Allow database access from anywhere"
							/>
						</div>

						{!allowAnywhere && (
							<div className="space-y-1.5 pt-2">
								<label htmlFor="database-cidrs-input" className="text-xs font-medium text-foreground">
									Allowed CIDRs / IP Addresses
								</label>
								<Input
									id="database-cidrs-input"
									value={cidrs}
									onChange={(e) => setCidrs(e.target.value)}
									placeholder="203.0.113.4/32, 10.0.0.0/8"
									className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
								/>
							</div>
						)}
					</div>

					{/* Backup & Retention Controls */}
					<div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-md space-y-4 shadow-xl">
						<h2 className="text-sm font-bold text-foreground flex items-center gap-2">
							<Clock className="h-4 w-4 text-emerald-400" />
							5. Instance Backup & Retention Schedule
						</h2>
						<div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/40 bg-black/20">
							<div>
								<p className="text-xs font-semibold text-foreground">Enable Scheduled Backups</p>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									Automate dumps using the configured global backup storage location.
								</p>
							</div>
							<input
								type="checkbox"
								checked={backupEnabled}
								onChange={(e) => setBackupEnabled(e.target.checked)}
								className="h-4 w-4 accent-orange-500 rounded"
								aria-label="Enable scheduled backups"
							/>
						</div>

						{backupEnabled && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
								<div className="space-y-1.5">
									<label htmlFor="database-backup-schedule" className="text-xs font-medium text-foreground">
										Backup Cron Schedule
									</label>
									<Input
										id="database-backup-schedule"
										value={backupSchedule}
										onChange={(e) => setBackupSchedule(e.target.value)}
										placeholder="0 */6 * * *"
										className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
									/>
									<div className="flex flex-wrap gap-1.5 pt-1">
										<button
											type="button"
											onClick={() => setBackupSchedule("0 */6 * * *")}
											className="text-[10px] bg-background/60 hover:bg-muted border border-border/60 px-2 py-0.5 rounded-lg font-mono text-muted-foreground"
										>
											Every 6h
										</button>
										<button
											type="button"
											onClick={() => setBackupSchedule("0 0 * * *")}
											className="text-[10px] bg-background/60 hover:bg-muted border border-border/60 px-2 py-0.5 rounded-lg font-mono text-muted-foreground"
										>
											Daily 00:00
										</button>
										<button
											type="button"
											onClick={() => setBackupSchedule("0 */12 * * *")}
											className="text-[10px] bg-background/60 hover:bg-muted border border-border/60 px-2 py-0.5 rounded-lg font-mono text-muted-foreground"
										>
											Every 12h
										</button>
									</div>
								</div>

								<div className="space-y-1.5">
									<label htmlFor="database-backup-retention" className="text-xs font-medium text-foreground">
										Max Retention Count
									</label>
									<Input
										id="database-backup-retention"
										type="number"
										min="1"
										max="30"
										value={backupRetention}
										onChange={(e) => setBackupRetention(e.target.value)}
										className="bg-background/50 border-border/80 font-mono text-xs rounded-xl h-10"
									/>
									<p className="text-[10px] text-muted-foreground">Keep the latest N completed dumps.</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Summary & Provision Action Sidebar */}
				<div className="space-y-6">
					<div className="rounded-3xl border border-border/60 bg-card/80 p-6 backdrop-blur-md space-y-6 shadow-2xl sticky top-8">
						<h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Provision Summary</h3>

						<div className="space-y-3 text-xs divide-y divide-border/40">
							<div className="flex justify-between py-2">
								<span className="text-muted-foreground">Engine</span>
								<span className="font-semibold text-foreground uppercase">{type}</span>
							</div>
							<div className="flex justify-between py-2">
								<span className="text-muted-foreground">Version</span>
								<span className="font-mono text-foreground">{version}</span>
							</div>
							<div className="flex justify-between py-2">
								<span className="text-muted-foreground">CPU / RAM</span>
								<span className="font-mono text-foreground">
									{cpu} Cores / {memory} MB
								</span>
							</div>
							<div className="flex justify-between py-2">
								<span className="text-muted-foreground">Storage Quota</span>
								<span className="font-mono text-foreground">{storage} MB</span>
							</div>
							<div className="flex justify-between py-2">
								<span className="text-muted-foreground">Scheduled Backups</span>
								<span className="font-mono text-foreground">
									{backupEnabled ? `Cron: ${backupSchedule}` : "Disabled"}
								</span>
							</div>
						</div>

						{error && (
							<p
								role="alert"
								className="text-xs text-red-400 flex items-center gap-1.5 bg-red-500/10 p-3 rounded-xl border border-red-500/20"
							>
								<ShieldAlert className="h-4 w-4 shrink-0" />
								{error}
							</p>
						)}

						<Button
							onClick={handleCreate}
							disabled={isCreating || !name.trim() || (!allowAnywhere && !cidrs.trim())}
							className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-12 rounded-2xl shadow-xl transition-all"
						>
							{isCreating ? "Provisioning Engine..." : "Provision Managed Database"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
