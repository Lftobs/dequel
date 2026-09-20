import { useNavigate } from "@tanstack/react-router";
import {
	Check,
	Copy,
	Database,
	ExternalLink,
	Eye,
	EyeOff,
	HardDrive,
	Network,
	Pause,
	Play,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import type { Database as DatabaseRecord, Project } from "../../types";
import { StatusBadge } from "../StatusBadge";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface DatabaseCardProps {
	database: DatabaseRecord;
	project?: Project;
	onChanged: () => void;
	onDelete: (database: DatabaseRecord) => void;
}

export function DatabaseCard({ database, project, onChanged, onDelete }: DatabaseCardProps) {
	const navigate = useNavigate();
	const [credentials, setCredentials] = useState<Awaited<ReturnType<typeof api.getDatabaseCredentials>> | null>(null);
	const [credentialsError, setCredentialsError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [copiedConnection, setCopiedConnection] = useState(false);

	const reveal = async () => {
		if (credentials) return setCredentials(null);
		setCredentialsError(null);
		try {
			setCredentials(await api.getDatabaseCredentials(database.id));
		} catch (err) {
			setCredentialsError(err instanceof Error ? err.message : "Could not load credentials");
		}
	};

	const handleCopyConnection = (connString: string) => {
		navigator.clipboard.writeText(connString);
		setCopiedConnection(true);
		setTimeout(() => setCopiedConnection(false), 2000);
	};

	const lifecycle = async (action: "start" | "stop" | "restart" | "retry") => {
		setIsBusy(true);
		setActionError(null);
		try {
			if (action === "start") await api.startDatabase(database.id);
			else if (action === "stop") await api.stopDatabase(database.id);
			else if (action === "retry") await api.retryDatabase(database.id);
			else await api.restartDatabase(database.id);
			onChanged();
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "Action failed");
		} finally {
			setIsBusy(false);
		}
	};

	const storagePercent = database.storageLimitMb
		? Math.min(100, Math.round((database.storageUsedMb / database.storageLimitMb) * 100))
		: 0;

	const connString = credentials?.externalConnectionString ?? credentials?.internalConnectionString;

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl hover:border-orange-500/30 transition-all overflow-hidden flex flex-col justify-between">
			<CardContent className="space-y-5 p-4 sm:p-6">
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1.5">
						<div className="flex items-center gap-2">
							<Badge
								variant="outline"
								className="border-orange-500/30 bg-orange-500/10 text-[10px] uppercase font-mono tracking-wider text-orange-400"
							>
								{database.type}
							</Badge>
							<StatusBadge status={database.status} />
						</div>
						<h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
							<Database className="h-4 w-4 text-orange-400" />
							{database.name}
						</h3>
						<p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
							<span>{project ? `Project: ${project.name}` : "Standalone Database"}</span>
							<span>·</span>
							<span className="font-mono text-zinc-400">{database.databaseName}</span>
						</p>
					</div>

					<Button
						variant="ghost"
						size="icon"
						disabled={isBusy}
						aria-label={`Delete ${database.name}`}
						onClick={() => onDelete(database)}
						className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
					<div className="rounded-xl border border-border/80 bg-black/40 p-3 space-y-1">
						<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
							<Network className="h-3.5 w-3.5 text-orange-400" />
							Internal Cluster Endpoint
						</div>
						<p className="break-all font-mono text-xs text-zinc-200">
							{database.internalHost}:{database.internalPort}
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-black/40 p-3 space-y-1">
						<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
							<HardDrive className="h-3.5 w-3.5 text-blue-400" />
							Public Port Access
						</div>
						<p className="font-mono text-xs text-zinc-200">
							{database.publicAccess
								? database.externalPort
									? `:${database.externalPort}`
									: "Provisioning..."
								: "Disabled"}
						</p>
					</div>
				</div>

				<div className="space-y-1.5">
					<div className="flex justify-between text-xs font-medium">
						<span className="text-muted-foreground">Disk Storage Usage</span>
						<span
							className={
								storagePercent >= 100
									? "text-red-400 font-semibold"
									: storagePercent >= 80
										? "text-amber-400 font-semibold"
										: "text-zinc-300"
							}
						>
							{database.storageUsedMb} MB{database.storageLimitMb ? ` / ${database.storageLimitMb} MB` : ""} (
							{storagePercent}%)
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-black/60 border border-border/60">
						<div
							className={`h-full transition-all rounded-full ${
								storagePercent >= 100 ? "bg-red-500" : storagePercent >= 80 ? "bg-amber-500" : "bg-orange-500"
							}`}
							style={{ width: `${Math.max(5, storagePercent)}%` }}
						/>
					</div>
				</div>

				<div className="rounded-xl border border-border/80 bg-black/50 p-3.5 space-y-2">
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0 flex-1">
							<div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">
								Connection String
							</div>
							<p className="min-w-0 truncate font-mono text-xs text-zinc-300">
								{connString ?? "••••••••••••••••••••••••••••••••"}
							</p>
						</div>

						<div className="flex items-center gap-1 shrink-0">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={reveal}
								aria-label={credentials ? "Hide credentials" : "Reveal credentials"}
								className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
							>
								{credentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</Button>

							{credentials && connString && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => handleCopyConnection(connString)}
									aria-label="Copy connection string"
									className="h-8 text-xs text-emerald-400 hover:bg-emerald-500/10 gap-1 px-2 rounded-lg"
								>
									{copiedConnection ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
									{copiedConnection ? "Copied" : "Copy"}
								</Button>
							)}
						</div>
					</div>

					{credentialsError && (
						<p role="alert" className="text-xs text-red-400">
							{credentialsError}
						</p>
					)}
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4">
					<div className="flex flex-wrap gap-2">
						{database.status === "stopped" ? (
							<Button
								size="sm"
								disabled={isBusy}
								onClick={() => lifecycle("start")}
								className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium text-xs h-8 px-3.5 gap-1.5"
							>
								<Play className="h-3.5 w-3.5" /> Start Node
							</Button>
						) : database.status === "failed" ? (
							<Button
								size="sm"
								disabled={isBusy}
								onClick={() => lifecycle("retry")}
								className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs h-8 px-3.5 gap-1.5"
							>
								<RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} /> Retry
							</Button>
						) : (
							<Button
								size="sm"
								variant="outline"
								disabled={isBusy || database.status !== "running"}
								onClick={() => lifecycle("stop")}
								className="text-xs h-8 border-border/60 hover:bg-card text-muted-foreground hover:text-foreground gap-1.5"
							>
								<Pause className="h-3.5 w-3.5" /> Stop
							</Button>
						)}

						<Button
							size="sm"
							variant="outline"
							disabled={isBusy || database.status !== "running"}
							onClick={() => lifecycle("restart")}
							className="text-xs h-8 border-border/60 hover:bg-card text-muted-foreground hover:text-foreground gap-1.5"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} /> Restart
						</Button>
					</div>

					<Button
						size="sm"
						onClick={() => navigate({ to: "/databases/$databaseId", params: { databaseId: database.id } })}
						className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs h-8 px-3 rounded-lg gap-1.5 shadow-sm"
					>
						Open Workspace <ExternalLink className="h-3.5 w-3.5" />
					</Button>
				</div>

				{actionError && (
					<p role="alert" className="text-xs text-red-400">
						{actionError}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
