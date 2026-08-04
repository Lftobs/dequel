import { useState } from "react";
import { Copy, Eye, EyeOff, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import * as api from "../../api/client";
import type { Database, Project } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { StatusBadge } from "../StatusBadge";

interface DatabaseCardProps {
	database: Database;
	project?: Project;
	onChanged: () => void;
	onDelete: (database: Database) => void;
}

export function DatabaseCard({ database, project, onChanged, onDelete }: DatabaseCardProps) {
	const [credentials, setCredentials] = useState<Awaited<ReturnType<typeof api.getDatabaseCredentials>> | null>(null);
	const [credentialsError, setCredentialsError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);

	const reveal = async () => {
		if (credentials) return setCredentials(null);
		setCredentialsError(null);
		try {
			setCredentials(await api.getDatabaseCredentials(database.id));
		} catch (err) {
			setCredentialsError(err instanceof Error ? err.message : "Could not load credentials");
		}
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

	return (
		<Card className="border-border bg-card/60">
			<CardContent className="space-y-5 p-5">
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="mb-2 flex items-center gap-2">
							<Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-[10px] uppercase text-amber-400">{database.type}</Badge>
							<StatusBadge status={database.status} />
						</div>
						<h3 className="font-semibold text-zinc-100">{database.name}</h3>
						<p className="mt-1 text-xs text-zinc-500">{project?.name ?? "Standalone"} · {database.databaseName}</p>
					</div>
					<Button variant="ghost" size="icon" disabled={isBusy} aria-label={`Delete ${database.name}`} onClick={() => onDelete(database)} className="text-zinc-500 hover:text-red-400">
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>

				<div className="grid grid-cols-2 gap-3 text-xs">
					<div className="rounded-lg border border-border bg-black/20 p-3">
						<p className="text-zinc-500">Internal endpoint</p>
						<p className="mt-1 break-all font-mono text-zinc-200">{database.internalHost}:{database.internalPort}</p>
					</div>
					<div className="rounded-lg border border-border bg-black/20 p-3">
						<p className="text-zinc-500">Public port</p>
						<p className="mt-1 font-mono text-zinc-200">{database.publicAccess ? (database.externalPort ? `:${database.externalPort}` : "Provisioning") : "Disabled"}</p>
					</div>
				</div>

				<div>
					<div className="mb-2 flex justify-between text-xs">
						<span className="text-zinc-500">Storage usage</span>
						<span className={storagePercent >= 100 ? "text-red-400" : storagePercent >= 80 ? "text-amber-400" : "text-zinc-300"}>
							{database.storageUsedMb} MB{database.storageLimitMb ? ` / ${database.storageLimitMb} MB` : ""}
						</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
						<div className="h-full bg-amber-500 transition-all" style={{ width: `${storagePercent}%` }} />
					</div>
				</div>

				<div className="rounded-lg border border-border bg-[#08080a] p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="min-w-0 truncate font-mono text-[11px] text-zinc-400">
							{credentials?.externalConnectionString ?? credentials?.internalConnectionString ?? "Credentials hidden"}
						</p>
						<div className="flex shrink-0 gap-1">
							<button type="button" onClick={reveal} className="p-1 text-zinc-500 hover:text-zinc-200" aria-label={credentials ? "Hide credentials" : "Reveal credentials"}>
								{credentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
							{credentials && <button type="button" onClick={() => navigator.clipboard.writeText(credentials.externalConnectionString ?? credentials.internalConnectionString)} className="p-1 text-zinc-500 hover:text-zinc-200" aria-label="Copy connection string"><Copy className="h-4 w-4" /></button>}
						</div>
					</div>
					{credentialsError && <p role="alert" className="mt-2 text-xs text-red-400">{credentialsError}</p>}
				</div>

				<div className="flex gap-2 border-t border-border pt-4">
					{database.status === "stopped" ? (
						<Button size="sm" disabled={isBusy} onClick={() => lifecycle("start")}><Play className="mr-2 h-3.5 w-3.5" /> Start</Button>
					) : database.status === "failed" ? (
						<Button size="sm" disabled={isBusy} onClick={() => lifecycle("retry")}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry</Button>
					) : (
						<Button size="sm" variant="outline" disabled={isBusy || database.status !== "running"} onClick={() => lifecycle("stop")}><Pause className="mr-2 h-3.5 w-3.5" /> Stop</Button>
					)}
					<Button size="sm" variant="outline" disabled={isBusy || database.status !== "running"} onClick={() => lifecycle("restart")}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Restart</Button>
				</div>
				{actionError && <p role="alert" className="text-xs text-red-400">{actionError}</p>}
			</CardContent>
		</Card>
	);
}
