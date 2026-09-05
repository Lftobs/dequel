import { useQuery } from "@tanstack/react-query";
import { Database, Plus } from "lucide-react";
import { useState } from "react";
import * as api from "../api/client";
import { CreateDatabaseDialog } from "../components/databases/CreateDatabaseDialog";
import { DatabaseCard } from "../components/databases/DatabaseCard";
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
	const [isCreating, setIsCreating] = useState(false);
	const [deleting, setDeleting] = useState<DatabaseRecord | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const databases = useQuery({ queryKey: ["databases"], queryFn: api.listAllDatabases, refetchInterval: 10_000 });
	const projects = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
	const refresh = () => void databases.refetch();

	return (
		<div className="mx-auto max-w-6xl space-y-7">
			<div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
				<div>
					<p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-amber-500">Data services</p>
					<h1 className="text-2xl font-semibold text-zinc-100">Managed databases</h1>
					<p className="mt-2 max-w-2xl text-sm text-zinc-500">
						Provision persistent databases independently, or attach one to a project at creation time. Every database
						receives an internal endpoint and credential-protected public endpoint.
					</p>
				</div>
				<Button onClick={() => setIsCreating(true)}>
					<Plus className="mr-2 h-4 w-4" /> New database
				</Button>
			</div>

			{databases.isError ? (
				<div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-card/20 text-center">
					<p className="text-sm text-zinc-400">Failed to load managed databases.</p>
					<Button className="mt-4" variant="outline" onClick={() => void databases.refetch()}>
						Retry
					</Button>
				</div>
			) : databases.isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="h-80 animate-pulse rounded-xl bg-zinc-900" />
					<div className="h-80 animate-pulse rounded-xl bg-zinc-900" />
				</div>
			) : databases.data?.length ? (
				<div className="grid gap-4 lg:grid-cols-2">
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
				<div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/20 text-center">
					<Database className="mb-4 h-8 w-8 text-zinc-600" />
					<h2 className="font-medium text-zinc-200">No managed databases</h2>
					<p className="mt-2 max-w-sm text-sm text-zinc-500">
						Create a standalone database, or attach one to a project at creation time.
					</p>
					<Button className="mt-5" onClick={() => setIsCreating(true)}>
						<Plus className="mr-2 h-4 w-4" /> Create database
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
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete database</DialogTitle>
						<DialogDescription>
							This permanently removes {deleting?.name}, its container, public endpoint, and stored data.
						</DialogDescription>
					</DialogHeader>
					{deleteError && (
						<p role="alert" className="text-sm text-red-400">
							{deleteError}
						</p>
					)}
					<DialogFooter>
						<Button variant="ghost" disabled={isDeleting} onClick={() => setDeleting(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
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
						>
							{isDeleting ? "Deleting..." : "Delete permanently"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
