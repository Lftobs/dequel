import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { StatusBadge } from "../StatusBadge";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { AddServerForm } from "./servers/AddServerForm";
import { ServerPreparationOutput } from "./servers/ServerPreparationOutput";

export function ServersSection() {
	const { data: servers = [], refetch } = useQuery({
		queryKey: ["servers"],
		queryFn: () => api.listServers().catch(() => []),
	});
	const { data: sshKeys = [] } = useQuery({
		queryKey: ["ssh-keys"],
		queryFn: () => api.listSshKeys().catch(() => []),
	});

	const [isAdding, setIsAdding] = useState(false);
	const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
	const [preparingId, setPreparingId] = useState<string | null>(null);
	const [prepareLogs, setPrepareLogs] = useState<{ stage: string; message: string }[]>([]);
	const [prepareDone, setPrepareDone] = useState(false);
	const [prepareError, setPrepareError] = useState<string | null>(null);

	const handlePrepare = async (serverId: string) => {
		setPreparingId(serverId);
		setPrepareLogs([]);
		setPrepareDone(false);
		setPrepareError(null);
		try {
			await api.prepareServer(serverId);
		} catch (err) {
			setPrepareError(err instanceof Error ? err.message : "Could not start preparation");
		}
	};

	useEffect(() => {
		if (!preparingId) return;
		const source = new EventSource(api.serverPrepareStreamUrl(preparingId));
		source.addEventListener("log", (e) => {
			try {
				const event = JSON.parse((e as MessageEvent).data);
				setPrepareLogs((prev) => [...prev, { stage: event.stage, message: event.message }]);
			} catch {}
		});
		source.addEventListener("done", (e) => {
			try {
				const event = JSON.parse((e as MessageEvent).data);
				setPrepareDone(true);
				setPrepareError(event.ok ? null : event.error || "Preparation failed");
				setPreparingId(null);
				refetch();
			} catch {}
		});
		source.addEventListener("error", () => {
			setPrepareDone(true);
			setPreparingId(null);
		});
		return () => source.close();
	}, [preparingId, refetch]);

	const handleDeleteServer = async () => {
		if (!deletingServerId) return;
		await api.deleteServer(deletingServerId);
		setDeletingServerId(null);
		refetch();
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
							<Server className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg font-semibold text-foreground">Cluster Infrastructure Nodes</CardTitle>
							<p className="text-xs text-muted-foreground mt-0.5">
								Connect remote cloud servers (Hetzner, AWS, DigitalOcean) or homelab nodes for automated container deployment.
							</p>
						</div>
					</div>
					<Button
						onClick={() => setIsAdding(!isAdding)}
						size="sm"
						className="bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md transition-all gap-1.5 self-start sm:self-auto"
					>
						<Plus className="h-4 w-4" />
						Connect Server
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-6 space-y-6">
				{isAdding && (
					<AddServerForm
						sshKeys={sshKeys}
						onServerAdded={() => {
							setIsAdding(false);
							refetch();
						}}
						onCancel={() => setIsAdding(false)}
					/>
				)}

				{servers.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-12 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground mb-3">
							<Server className="h-6 w-6" />
						</div>
						<h3 className="text-sm font-semibold text-foreground">No Nodes Registered</h3>
						<p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
							Add a cloud server or local homelab machine to deploy applications to remote environments.
						</p>
						<Button
							size="sm"
							onClick={() => setIsAdding(true)}
							variant="outline"
							className="text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
						>
							Connect First Server
						</Button>
					</div>
				) : (
					<div className="rounded-xl border border-border/60 overflow-hidden bg-card/30">
						<div className="md:hidden divide-y divide-border/40">
							{servers.map((s) => (
								<div key={s.id} className="p-3.5 space-y-2.5">
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2 min-w-0">
											<Server className="h-4 w-4 text-orange-400 shrink-0" />
											<span className="font-semibold text-foreground text-sm truncate">{s.name}</span>
										</div>
										<StatusBadge status={s.status || "active"} />
									</div>
									<p className="text-xs font-mono text-muted-foreground break-all">
										{s.mode === "agent" ? `WireGuard P2P ${s.agentVersion || ""}` : `SSH (${s.sshUser || "root"}@${s.host}:${s.port})`}
									</p>
									<div className="flex items-center justify-end gap-2 pt-1 border-t border-border/30">
										{s.mode !== "local" && (
											<Button
												variant="outline"
												size="sm"
												className="h-8 text-xs flex-1 sm:flex-none border-border/60 hover:bg-orange-500/10 hover:text-orange-400 gap-1.5"
												disabled={preparingId !== null}
												onClick={() => handlePrepare(s.id)}
											>
												<RefreshCw className={`h-3 w-3 ${preparingId === s.id ? "animate-spin text-orange-400" : ""}`} />
												{preparingId === s.id ? "Preparing..." : "Prepare"}
											</Button>
										)}
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
											onClick={() => setDeletingServerId(s.id)}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
							))}
						</div>

						<div className="hidden md:block overflow-x-auto">
							<Table className="w-full">
								<TableHeader className="bg-muted/40">
									<TableRow className="border-border/60 hover:bg-transparent">
										<TableHead className="text-xs font-semibold">Node Name</TableHead>
										<TableHead className="text-xs font-semibold">Connection String</TableHead>
										<TableHead className="text-xs font-semibold">Status</TableHead>
										<TableHead className="text-xs font-semibold text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{servers.map((s) => (
										<TableRow key={s.id} className="border-border/40 hover:bg-muted/20">
											<TableCell className="font-medium text-foreground text-xs py-3.5">
												<div className="flex items-center gap-2">
													<Server className="h-4 w-4 text-orange-400" />
													<span>{s.name}</span>
												</div>
											</TableCell>
											<TableCell className="font-mono text-xs text-muted-foreground py-3.5">
												<Badge
													variant="outline"
													className="font-mono text-[11px] bg-black/40 text-zinc-300 border-border/60"
												>
													{s.mode === "agent"
														? `WireGuard P2P ${s.agentVersion || ""}`
														: `SSH (${s.sshUser || "root"}@${s.host}:${s.port})`}
												</Badge>
											</TableCell>
											<TableCell className="py-3.5">
												<StatusBadge status={s.status || "active"} />
											</TableCell>
											<TableCell className="text-right py-3.5">
												<div className="flex items-center justify-end gap-2">
													{s.mode !== "local" && (
														<Button
															variant="outline"
															size="sm"
															className="h-8 text-xs border-border/60 hover:bg-orange-500/10 hover:text-orange-400 gap-1.5"
															disabled={preparingId !== null}
															onClick={() => handlePrepare(s.id)}
														>
															<RefreshCw
																className={`h-3 w-3 ${preparingId === s.id ? "animate-spin text-orange-400" : ""}`}
															/>
															{preparingId === s.id ? "Preparing..." : "Prepare Node"}
														</Button>
													)}
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
														onClick={() => setDeletingServerId(s.id)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>
				)}

				<ServerPreparationOutput
					preparingId={preparingId}
					prepareLogs={prepareLogs}
					prepareDone={prepareDone}
					prepareError={prepareError}
				/>
			</CardContent>

			<Dialog open={deletingServerId !== null} onOpenChange={(open) => !open && setDeletingServerId(null)}>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Remove Cluster Node</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
							Are you sure you want to remove this server from the cluster? Active deployments running on this node may
							stop responding.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() => setDeletingServerId(null)}
							className="h-9 text-xs px-4 rounded-xl hover:bg-muted"
						>
							Cancel
						</Button>
						<Button
							onClick={handleDeleteServer}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-9 text-xs px-5 rounded-xl shadow-lg transition-all"
						>
							Remove Server
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
