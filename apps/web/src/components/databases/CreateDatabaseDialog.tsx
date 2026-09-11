import { Database, HardDrive, ShieldAlert, Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../api/client";
import type { DatabaseType, Project } from "../../types";
import { Button } from "../ui/button";
import { DATABASE_ENGINES, DatabaseSelect } from "../ui/DatabaseSelect";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface CreateDatabaseDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projects: Project[];
	defaultProjectId?: string | null;
	onCreated: () => void;
}

export function CreateDatabaseDialog({
	open,
	onOpenChange,
	projects,
	defaultProjectId = null,
	onCreated,
}: CreateDatabaseDialogProps) {
	const [name, setName] = useState("");
	const [projectId, setProjectId] = useState(defaultProjectId ?? "standalone");
	const [type, setType] = useState<DatabaseType>("postgresql");
	const [version, setVersion] = useState("16");
	const [cpu, setCpu] = useState("1");
	const [memory, setMemory] = useState("512");
	const [storage, setStorage] = useState("10240");
	const [allowAnywhere, setAllowAnywhere] = useState(false);
	const [cidrs, setCidrs] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const engine = DATABASE_ENGINES.find((item) => item.type === type);
		if (engine) setVersion(engine.defaultVersion);
	}, [type]);

	const create = async () => {
		setIsCreating(true);
		setError(null);
		try {
			await api.createDatabase(projectId === "standalone" ? null : projectId, type, {
				name,
				version,
				cpuLimit: Number(cpu),
				memoryLimitMb: Number(memory),
				storageLimitMb: Number(storage),
				publicAccess: true,
				allowPublicAccessFromAnywhere: allowAnywhere,
				allowedCidrs: cidrs
					.split(/[\n,]/)
					.map((value) => value.trim())
					.filter(Boolean),
			});
			onCreated();
			onOpenChange(false);
			setName("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Database creation failed");
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 bg-card/95 backdrop-blur-xl sm:max-w-[560px] rounded-3xl shadow-2xl">
				<DialogHeader className="border-b border-border/40 pb-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
							<Database className="h-5 w-5" />
						</div>
						<div>
							<DialogTitle className="text-lg font-bold text-foreground">Provision Managed Database</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground mt-0.5">
								Public access endpoint enabled with optional CIDR network IP allowlisting.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-5 pt-2">
					<div className="space-y-1.5">
						<label htmlFor="database-name" className="text-xs font-medium text-foreground">
							Database Display Name
						</label>
						<Input
							id="database-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="e.g. Production PostgreSQL DB"
							className="bg-background/50 border-border/80 text-xs focus:ring-orange-500/50"
						/>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<label htmlFor="database-project" className="text-xs font-medium text-foreground">
								Project Attachment
							</label>
							<Select value={projectId} onValueChange={setProjectId}>
								<SelectTrigger id="database-project" className="bg-background/50 border-border/80 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-card border-border text-xs">
									<SelectItem value="standalone">Standalone Database</SelectItem>
									{projects.map((project) => (
										<SelectItem key={project.id} value={project.id}>
											{project.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<label htmlFor="database-engine" className="text-xs font-medium text-foreground">
								Database Engine
							</label>
							<DatabaseSelect id="database-engine" value={type} onValueChange={(val) => setType(val)} />
						</div>
					</div>

					<div className="space-y-1.5">
						<label htmlFor="database-version" className="text-xs font-medium text-foreground">
							Engine Tag / Version
						</label>
						<Input
							id="database-version"
							value={version}
							onChange={(event) => setVersion(event.target.value)}
							className="bg-background/50 border-border/80 text-xs font-mono"
						/>
					</div>

					<div className="rounded-2xl border border-border/60 bg-black/30 p-4 space-y-3">
						<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
							<Cpu className="h-3.5 w-3.5 text-orange-400" />
							Resource Limits & Storage Allocation
						</span>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div className="space-y-1">
								<label htmlFor="database-cpu" className="text-[11px] font-medium text-muted-foreground">
									CPU Cores
								</label>
								<Input
									id="database-cpu"
									type="number"
									min="0.1"
									step="0.1"
									value={cpu}
									onChange={(event) => setCpu(event.target.value)}
									className="bg-background/50 border-border/80 text-xs font-mono"
								/>
							</div>
							<div className="space-y-1">
								<label htmlFor="database-memory" className="text-[11px] font-medium text-muted-foreground">
									RAM (MB)
								</label>
								<Input
									id="database-memory"
									type="number"
									min="64"
									value={memory}
									onChange={(event) => setMemory(event.target.value)}
									className="bg-background/50 border-border/80 text-xs font-mono"
								/>
							</div>
							<div className="space-y-1">
								<label htmlFor="database-storage" className="text-[11px] font-medium text-muted-foreground">
									Storage (MB)
								</label>
								<Input
									id="database-storage"
									type="number"
									min="64"
									value={storage}
									onChange={(event) => setStorage(event.target.value)}
									className="bg-background/50 border-border/80 text-xs font-mono"
								/>
							</div>
						</div>
					</div>

					<div className="rounded-2xl border border-border/80 bg-black/40 p-4 space-y-3">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
									<HardDrive className="h-3.5 w-3.5 text-blue-400" />
									Allow Access From Anywhere
								</p>
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									Uncheck to restrict connection requests to specific IP ranges.
								</p>
							</div>
							<input
								type="checkbox"
								checked={allowAnywhere}
								onChange={(event) => setAllowAnywhere(event.target.checked)}
								className="h-4 w-4 accent-orange-500 rounded"
								aria-label="Allow public database access from anywhere"
							/>
						</div>

						{!allowAnywhere && (
							<div className="space-y-1.5 pt-2 border-t border-border/40">
								<label htmlFor="database-cidrs" className="text-xs font-medium text-foreground">
									Allowed CIDR Addresses / IPs
								</label>
								<Input
									id="database-cidrs"
									value={cidrs}
									onChange={(event) => setCidrs(event.target.value)}
									placeholder="203.0.113.4/32, 10.0.0.0/8"
									className="bg-background/50 border-border/80 font-mono text-xs"
								/>
							</div>
						)}
					</div>

					{error && (
						<p role="alert" className="text-xs text-red-400 flex items-center gap-1.5">
							<ShieldAlert className="h-3.5 w-3.5" />
							{error}
						</p>
					)}

					<div className="flex justify-end gap-2 border-t border-border/40 pt-4">
						<Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs text-muted-foreground">
							Cancel
						</Button>
						<Button
							disabled={isCreating || !name.trim() || (!allowAnywhere && !cidrs.trim())}
							onClick={create}
							className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs px-5 shadow-md"
						>
							{isCreating ? "Provisioning..." : "Provision Database"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
