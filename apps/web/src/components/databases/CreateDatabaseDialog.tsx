import { useEffect, useState } from "react";
import * as api from "../../api/client";
import type { DatabaseType, Project } from "../../types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { DatabaseSelect } from "../ui/DatabaseSelect";

interface CreateDatabaseDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projects: Project[];
	defaultProjectId?: string | null;
	onCreated: () => void;
}

export function CreateDatabaseDialog({ open, onOpenChange, projects, defaultProjectId = null, onCreated }: CreateDatabaseDialogProps) {
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
		setVersion(type === "postgresql" ? "16" : type === "mysql" ? "8.4" : type === "redis" ? "7.4" : type === "mongodb" ? "7.0" : "11.4");
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
				allowedCidrs: cidrs.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
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
			<DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-[560px]">
				<DialogHeader>
					<DialogTitle>Create managed database</DialogTitle>
					<DialogDescription>Public access is enabled by default and protected by database credentials plus the network allowlist.</DialogDescription>
				</DialogHeader>
				<div className="space-y-5 pt-2">
					<div className="grid gap-2"><label htmlFor="database-name" className="text-xs font-medium text-zinc-400">Name</label><Input id="database-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Production Database" /></div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="grid gap-2"><label className="text-xs font-medium text-zinc-400">Attach to project</label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standalone">No project</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
						<div className="grid gap-2"><label className="text-xs font-medium text-zinc-400">Database Engine</label><DatabaseSelect value={type} onValueChange={(val) => setType(val)} /></div>
					</div>
					<div className="grid gap-2"><label htmlFor="database-version" className="text-xs font-medium text-zinc-400">Version</label><Input id="database-version" value={version} onChange={(event) => setVersion(event.target.value)} /></div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="grid gap-2"><label htmlFor="database-cpu" className="text-xs font-medium text-zinc-400">CPU cores</label><Input id="database-cpu" type="number" min="0.1" step="0.1" value={cpu} onChange={(event) => setCpu(event.target.value)} /></div>
						<div className="grid gap-2"><label htmlFor="database-memory" className="text-xs font-medium text-zinc-400">Memory MB</label><Input id="database-memory" type="number" min="64" value={memory} onChange={(event) => setMemory(event.target.value)} /></div>
						<div className="grid gap-2"><label htmlFor="database-storage" className="text-xs font-medium text-zinc-400">Storage limit MB</label><Input id="database-storage" type="number" min="64" value={storage} onChange={(event) => setStorage(event.target.value)} /><p className="text-[11px] text-zinc-500">Alerts at 80% and 100% usage; not a hard cap.</p></div>
					</div>
					<div className="rounded-lg border border-border bg-black/20 p-4">
						<div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Allow access from anywhere</p><p className="mt-1 text-xs text-zinc-500">Disable this to require source IP/CIDR matching.</p></div><input type="checkbox" checked={allowAnywhere} onChange={(event) => setAllowAnywhere(event.target.checked)} className="h-4 w-4 accent-amber-500" aria-label="Allow public database access from anywhere" /></div>
						{!allowAnywhere && <div className="mt-4 grid gap-2"><label htmlFor="database-cidrs" className="text-xs font-medium text-zinc-400">Allowed IPs or CIDRs</label><Input id="database-cidrs" value={cidrs} onChange={(event) => setCidrs(event.target.value)} placeholder="203.0.113.4/32, 10.0.0.0/8" /><p className="text-[11px] text-zinc-500">At least one address is required.</p></div>}
					</div>
					{error && <p role="alert" className="text-sm text-red-400">{error}</p>}
					<div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={isCreating || !name.trim() || (!allowAnywhere && !cidrs.trim())} onClick={create}>{isCreating ? "Creating..." : "Create database"}</Button></div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
