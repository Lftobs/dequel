import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Clock,
	Database as DatabaseIcon,
	HardDrive,
	Play,
	RefreshCw,
	RotateCw,
	ShieldAlert,
	Square,
	Table as TableIcon,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import * as api from "../api/client";
import { DatabaseBackupManager } from "../components/databases/DatabaseBackupManager";
import { DatabaseOverview } from "../components/databases/DatabaseOverview";
import { DatabaseSettingsForm } from "../components/databases/DatabaseSettingsForm";
import { DatabaseStudio } from "../components/databases/DatabaseStudio";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export function DatabaseDetail({ databaseId }: { databaseId: string }) {
	const navigate = useNavigate();
	const [isActionBusy, setIsActionBusy] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const [deleting, setDeleting] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const { data: database, refetch } = useQuery({
		queryKey: ["database", databaseId],
		queryFn: () => api.getDatabase(databaseId),
		refetchInterval: 5000,
	});

	const { data: creds } = useQuery({
		queryKey: ["database-credentials", databaseId],
		queryFn: () => api.getDatabaseCredentials(databaseId).catch(() => null),
		enabled: !!database,
	});

	const handleLifecycleAction = async (action: "start" | "stop" | "restart" | "retry") => {
		setIsActionBusy(true);
		setActionError(null);
		try {
			if (action === "start") await api.startDatabase(databaseId);
			if (action === "stop") await api.stopDatabase(databaseId);
			if (action === "restart") await api.restartDatabase(databaseId);
			if (action === "retry") await api.retryDatabase(databaseId);
			refetch();
		} catch (err: any) {
			setActionError(err.message || `Failed to ${action} database`);
		} finally {
			setIsActionBusy(false);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await api.deleteDatabase(databaseId);
			navigate({ to: "/databases" });
		} catch (err: any) {
			setActionError(err.message || "Failed to delete database");
			setIsDeleting(false);
			setDeleting(false);
		}
	};

	if (!database) {
		return (
			<div className="flex h-64 items-center justify-center">
				<RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-6xl space-y-8 pb-16">
			{/* Top Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="space-y-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate({ to: "/databases" })}
						className="text-xs text-muted-foreground hover:text-foreground gap-1.5 p-0 hover:bg-transparent"
					>
						<ArrowLeft className="h-4 w-4" /> Back to Managed Databases
					</Button>
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold tracking-tight text-foreground">{database.name}</h1>
						<Badge
							variant="outline"
							className={`text-xs uppercase font-mono px-2.5 py-0.5 ${
								database.status === "running"
									? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
									: database.status === "failed"
										? "border-red-500/40 text-red-400 bg-red-500/10"
										: "border-amber-500/40 text-amber-400 bg-amber-500/10"
							}`}
						>
							{database.status}
						</Badge>
						<Badge variant="outline" className="border-border/60 text-xs font-mono uppercase">
							{database.type} {database.version ? `v${database.version}` : ""}
						</Badge>
					</div>
				</div>

				{/* Lifecycle Actions */}
				<div className="flex items-center gap-2">
					{database.status === "stopped" && (
						<Button
							size="sm"
							onClick={() => handleLifecycleAction("start")}
							disabled={isActionBusy}
							className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 gap-1.5 rounded-xl shadow-md"
						>
							<Play className="h-3.5 w-3.5 fill-current" /> Start
						</Button>
					)}
					{database.status === "running" && (
						<Button
							size="sm"
							variant="outline"
							onClick={() => handleLifecycleAction("stop")}
							disabled={isActionBusy}
							className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs h-9 px-3 gap-1.5 rounded-xl"
						>
							<Square className="h-3.5 w-3.5 fill-current" /> Stop
						</Button>
					)}
					<Button
						size="sm"
						variant="outline"
						onClick={() => handleLifecycleAction("restart")}
						disabled={isActionBusy || database.status !== "running"}
						className="border-border/60 text-foreground hover:bg-muted text-xs h-9 px-3 gap-1.5 rounded-xl"
					>
						<RotateCw className={`h-3.5 w-3.5 ${isActionBusy ? "animate-spin" : ""}`} /> Restart
					</Button>
					{database.status === "failed" && (
						<Button
							size="sm"
							onClick={() => handleLifecycleAction("retry")}
							disabled={isActionBusy}
							className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-9 px-4 gap-1.5 rounded-xl shadow-md"
						>
							<RefreshCw className="h-3.5 w-3.5" /> Retry Provisioning
						</Button>
					)}
					<Button
						size="sm"
						variant="ghost"
						onClick={() => setDeleting(true)}
						className="text-red-400 hover:bg-red-500/10 text-xs h-9 px-3 rounded-xl"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{actionError && (
				<div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
					<ShieldAlert className="h-4 w-4 shrink-0" />
					{actionError}
				</div>
			)}

			{/* Main Workspace Tabs */}
			<Tabs defaultValue="overview" className="space-y-6">
				<TabsList>
					<TabsTrigger value="overview" className="gap-2">
						<DatabaseIcon className="h-3.5 w-3.5" />
						Overview & Connection
					</TabsTrigger>
					<TabsTrigger value="query" className="gap-2">
						<TableIcon className="h-3.5 w-3.5" />
						Data & Query Studio
					</TabsTrigger>
					<TabsTrigger value="backups" className="gap-2">
						<Clock className="h-3.5 w-3.5" />
						Backups & Restore
					</TabsTrigger>
					<TabsTrigger value="settings" className="gap-2">
						<HardDrive className="h-3.5 w-3.5" />
						Database Settings
					</TabsTrigger>
				</TabsList>

				{/* Tab 1: Overview & Connection */}
				<TabsContent value="overview">
					<DatabaseOverview database={database} creds={creds} />
				</TabsContent>

				{/* Tab 2: Data & Query Studio */}
				<TabsContent value="query">
					<DatabaseStudio database={database} />
				</TabsContent>

				{/* Tab 3: Backups & Restore */}
				<TabsContent value="backups">
					<DatabaseBackupManager database={database} />
				</TabsContent>

				{/* Tab 4: Database Settings */}
				<TabsContent value="settings">
					<DatabaseSettingsForm database={database} onRefetch={refetch} />
				</TabsContent>
			</Tabs>

			{/* Delete Modal */}
			<Dialog open={deleting} onOpenChange={setDeleting}>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Delete Database Instance</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
							Are you sure you want to permanently delete <strong>{database.name}</strong>? All database containers and
							volumes will be unmounted.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button variant="ghost" disabled={isDeleting} onClick={() => setDeleting(false)} className="h-9 text-xs">
							Cancel
						</Button>
						<Button
							disabled={isDeleting}
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground font-semibold h-9 text-xs px-5 rounded-xl shadow-lg"
						>
							{isDeleting ? "Deleting..." : "Delete Instance"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
