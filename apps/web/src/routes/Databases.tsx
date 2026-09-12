import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Database, HardDrive, Plus, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { useState } from "react";
import * as api from "../api/client";
import { CreateDatabaseDialog } from "../components/databases/CreateDatabaseDialog";
import { DatabaseCard } from "../components/databases/DatabaseCard";
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
import type { Database as DatabaseRecord } from "../types";

export function Databases() {
	const navigate = useNavigate();
	const [isCreating, setIsCreating] = useState(false);
	const [deleting, setDeleting] = useState<DatabaseRecord | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const databases = useQuery({ queryKey: ["databases"], queryFn: api.listAllDatabases, refetchInterval: 10_000 });
	const projects = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
	const refresh = () => void databases.refetch();

	const totalStorageAllocated = databases.data?.reduce((acc, db) => acc + (db.storageLimitMb || 0), 0) ?? 0;

	return (
		<div className="mx-auto max-w-6xl space-y-8 pb-12">
			{/* Hero Header */}
			<div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 via-card/40 to-background p-6 md:p-8 backdrop-blur-md shadow-2xl">
				<div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
				<div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

				<div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Badge
								variant="outline"
								className="border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5"
							>
								Managed Data Services
							</Badge>
						</div>
						<h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
							<Database className="h-7 w-7 text-orange-500" />
							Managed Databases
						</h1>
						<p className="max-w-2xl text-xs md:text-sm text-muted-foreground leading-relaxed">
							Provision standalone database instances or attach managed engines directly to project environments.
							Supports automated health checks, internal routing, and credentials.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-inner">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
								<Server className="h-4 w-4" />
							</div>
							<div>
								<div className="text-xs font-semibold text-foreground">{databases.data?.length ?? 0} Active</div>
								<div className="text-[10px] text-muted-foreground">Instances</div>
							</div>
						</div>

						<div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-inner">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
								<HardDrive className="h-4 w-4" />
							</div>
							<div>
								<div className="text-xs font-semibold text-foreground">
									{totalStorageAllocated > 0 ? `${Math.round(totalStorageAllocated / 1024)} GB` : "Dynamic"}
								</div>
								<div className="text-[10px] text-muted-foreground">Storage Pool</div>
							</div>
						</div>

						<Button
							onClick={() => navigate({ to: "/databases/new" })}
							size="sm"
							className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md transition-all gap-1.5 h-11 px-5 rounded-2xl"
						>
							<Plus className="h-4 w-4" />
							New Database
						</Button>
					</div>
				</div>
			</div>

			{/* Databases List Grid */}
			{databases.isError ? (
				<div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/40 bg-card/20 p-8 text-center">
					<p className="text-xs text-red-400">Failed to load managed databases.</p>
					<Button className="mt-4 text-xs" variant="outline" size="sm" onClick={refresh}>
						Retry Connection
					</Button>
				</div>
			) : databases.isLoading ? (
				<div className="grid gap-6 sm:grid-cols-2">
					<div className="h-72 animate-pulse rounded-2xl bg-card/40 border border-border/40" />
					<div className="h-72 animate-pulse rounded-2xl bg-card/40 border border-border/40" />
				</div>
			) : databases.data && databases.data.length > 0 ? (
				<div className="grid gap-6 lg:grid-cols-2">
					{databases.data.map((database) => (
						<DatabaseCard
							key={database.id}
							database={database}
							project={projects.data?.find((project) => project.id === database.projectId)}
							onChanged={refresh}
							onDelete={setDeleting}
						/>
					))}
				</div>
			) : (
				<div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/20 py-16 text-center">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground mb-3">
						<Database className="h-6 w-6" />
					</div>
					<h3 className="text-sm font-semibold text-foreground">No Managed Databases Found</h3>
					<p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
						Provision a standalone database, or attach one to a project environment at creation time.
					</p>
					<Button
						size="sm"
						onClick={() => setIsCreating(true)}
						variant="outline"
						className="mt-5 text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-1.5"
					>
						<Plus className="h-4 w-4" /> Provision Database
					</Button>
				</div>
			)}

			<CreateDatabaseDialog
				open={isCreating}
				onOpenChange={setIsCreating}
				projects={projects.data ?? []}
				onCreated={refresh}
			/>

			<Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Delete Managed Database</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
							Are you sure you want to permanently delete <strong>{deleting?.name}</strong>? This action removes its
							container, internal/external endpoints, and unmounts all underlying volume data.
						</DialogDescription>
					</DialogHeader>

					{deleteError && (
						<p role="alert" className="text-xs text-red-400">
							{deleteError}
						</p>
					)}

					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							disabled={isDeleting}
							onClick={() => setDeleting(null)}
							className="h-9 text-xs px-4 rounded-xl hover:bg-muted"
						>
							Cancel
						</Button>
						<Button
							disabled={isDeleting}
							onClick={async () => {
								if (!deleting) return;
								setIsDeleting(true);
								setDeleteError(null);
								try {
									await api.deleteDatabase(deleting.id);
									setDeleting(null);
									refresh();
								} catch (err) {
									setDeleteError(err instanceof Error ? err.message : "Deletion failed");
								} finally {
									setIsDeleting(false);
								}
							}}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-9 text-xs px-5 rounded-xl shadow-lg transition-all"
						>
							{isDeleting ? "Deleting..." : "Delete Permanently"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
