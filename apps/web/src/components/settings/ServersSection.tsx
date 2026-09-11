import { useQuery } from "@tanstack/react-query";
import {
	Check,
	Copy,
	HardDrive,
	KeyRound,
	Plus,
	RefreshCw,
	Server,
	ShieldAlert,
	Terminal,
	Trash2,
	Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { StatusBadge } from "../StatusBadge";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

export function ServersSection() {
	const { data: servers = [], refetch } = useQuery({
		queryKey: ["servers"],
		queryFn: () => api.listServers().catch(() => []),
	});
	const { data: sshKeys = [] } = useQuery({
		queryKey: ["ssh-keys"],
		queryFn: () => api.listSshKeys().catch(() => []),
	});

	const [activeTab, setActiveTab] = useState<"ssh" | "agent">("ssh");
	const [isAdding, setIsAdding] = useState(false);
	const [name, setName] = useState("");
	const [host, setHost] = useState("");
	const [port, setPort] = useState("22");
	const [sshUser, setSshUser] = useState("root");
	const [selectedKeyId, setSelectedKeyId] = useState("");
	const [agentName, setAgentName] = useState("");
	const [registrationCommand, setRegistrationCommand] = useState("");
	const [registrationError, setRegistrationError] = useState("");
	const [copiedCommand, setCopiedCommand] = useState(false);

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

	const addSshServer = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !host.trim()) return;
		await api.createServer({
			name: name.trim(),
			host: host.trim(),
			port: Number(port) || 22,
			mode: "ssh",
			sshUser: sshUser.trim() || "root",
			sshKeyId: selectedKeyId || undefined,
		});
		setName("");
		setHost("");
		setPort("22");
		setSshUser("root");
		setSelectedKeyId("");
		setIsAdding(false);
		refetch();
	};

	const createRegistration = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!agentName.trim()) return;
		setRegistrationError("");
		try {
			const result = await api.createAgentRegistrationToken({ name: agentName.trim() });
			const controlPlane = window.location.origin;
			setRegistrationCommand(
				`docker run -d --name dequel-agent --cap-add=NET_ADMIN --device /dev/net/tun --restart unless-stopped -e DEQUEL_CONTROL_PLANE=${controlPlane} -e DEQUEL_REGISTRATION_TOKEN=${result.token} -v dequel-agent-data:/root/.dequel -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/lftobs/dequel/agent:latest`,
			);
		} catch (err) {
			setRegistrationError(err instanceof Error ? err.message : "Could not create registration token");
		}
	};

	const handleCopyCommand = () => {
		if (!registrationCommand) return;
		navigator.clipboard.writeText(registrationCommand);
		setCopiedCommand(true);
		setTimeout(() => setCopiedCommand(false), 2000);
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
					<div className="rounded-2xl border border-border/80 bg-background/40 p-5 space-y-5 shadow-inner">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Select Connection Method
							</span>
							<div className="flex rounded-xl bg-black/40 p-1 border border-border/60">
								<button
									type="button"
									onClick={() => setActiveTab("ssh")}
									className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
										activeTab === "ssh"
											? "bg-orange-500 text-white shadow"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									<HardDrive className="h-3.5 w-3.5" />
									Direct SSH
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("agent")}
									className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
										activeTab === "agent"
											? "bg-orange-500 text-white shadow"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									<Wifi className="h-3.5 w-3.5" />
									WireGuard P2P Agent
								</button>
							</div>
						</div>

						{activeTab === "ssh" ? (
							<form onSubmit={addSshServer} className="space-y-4">
								<p className="text-xs text-muted-foreground leading-relaxed">
									Connect directly to any cloud VPS over SSH. Dequel manages container orchestration without requiring static agent installation.
								</p>
								<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
									<div className="space-y-1">
										<label htmlFor="server-name" className="text-xs font-medium text-foreground">
											Server Name
										</label>
										<Input
											id="server-name"
											placeholder="prod-node-1"
											value={name}
											onChange={(e) => setName(e.target.value)}
											className="bg-card border-border/80 text-xs"
											required
										/>
									</div>
									<div className="space-y-1">
										<label htmlFor="server-host" className="text-xs font-medium text-foreground">
											Host IP / Domain
										</label>
										<Input
											id="server-host"
											placeholder="192.168.1.10"
											value={host}
											onChange={(e) => setHost(e.target.value)}
											className="bg-card border-border/80 text-xs"
											required
										/>
									</div>
									<div className="space-y-1">
										<label htmlFor="server-port" className="text-xs font-medium text-foreground">
											SSH Port
										</label>
										<Input
											id="server-port"
											type="number"
											placeholder="22"
											value={port}
											onChange={(e) => setPort(e.target.value)}
											className="bg-card border-border/80 text-xs"
										/>
									</div>
									<div className="space-y-1">
										<label htmlFor="server-user" className="text-xs font-medium text-foreground">
											SSH User
										</label>
										<Input
											id="server-user"
											placeholder="root"
											value={sshUser}
											onChange={(e) => setSshUser(e.target.value)}
											className="bg-card border-border/80 text-xs"
										/>
									</div>
								</div>

								<div className="space-y-1.5">
									<label
										htmlFor="server-ssh-key"
										className="text-xs font-medium text-foreground flex items-center gap-1.5"
									>
										<KeyRound className="h-3.5 w-3.5 text-orange-400" />
										Attached SSH Key
									</label>
									<select
										id="server-ssh-key"
										className="w-full rounded-xl border border-border/80 bg-card px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
										value={selectedKeyId}
										onChange={(e) => setSelectedKeyId(e.target.value)}
									>
										<option value="">No key selected (Inline key fallback)</option>
										{sshKeys.map((k) => (
											<option key={k.id} value={k.id}>
												{k.name} ({k.fingerprint || "SSH Key"})
											</option>
										))}
									</select>
								</div>

								<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setIsAdding(false)}
										className="text-xs text-muted-foreground"
									>
										Cancel
									</Button>
									<Button
										type="submit"
										size="sm"
										className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-4"
									>
										Add SSH Server
									</Button>
								</div>
							</form>
						) : (
							<form onSubmit={createRegistration} className="space-y-4">
								<p className="text-xs text-muted-foreground leading-relaxed">
									Deploy a lightweight agent for firewalled nodes or local homelabs behind NAT. Establishes a secure P2P WireGuard tunnel.
								</p>
								<div className="flex flex-col sm:flex-row items-end gap-3">
									<div className="space-y-1 flex-1">
										<label htmlFor="agent-server-name" className="text-xs font-medium text-foreground">
											Agent Server Name
										</label>
										<Input
											id="agent-server-name"
											placeholder="homelab-node-1"
											value={agentName}
											onChange={(e) => setAgentName(e.target.value)}
											className="bg-card border-border/80 text-xs"
											required
										/>
									</div>
									<Button
										type="submit"
										size="sm"
										variant="outline"
										className="text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10 w-full sm:w-auto"
									>
										Generate Agent Command
									</Button>
								</div>

								{registrationCommand && (
									<div className="space-y-2 pt-2">
										<div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
											<span>Run Docker Command on Target Server</span>
										</div>
										<div className="relative rounded-2xl border border-border/80 bg-black/60 p-4 font-mono text-xs text-zinc-300">
											<p className="break-all pr-20">{registrationCommand}</p>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={handleCopyCommand}
												className="absolute right-3 top-3 h-8 bg-card/80 hover:bg-card text-xs text-zinc-300 gap-1.5 px-3 rounded-lg border border-border/40"
											>
												{copiedCommand ? (
													<Check className="h-3.5 w-3.5 text-emerald-400" />
												) : (
													<Copy className="h-3.5 w-3.5" />
												)}
												{copiedCommand ? "Copied" : "Copy"}
											</Button>
										</div>
									</div>
								)}

								{registrationError && (
									<p role="alert" className="text-xs text-red-400 flex items-center gap-1.5">
										<ShieldAlert className="h-3.5 w-3.5" />
										{registrationError}
									</p>
								)}
							</form>
						)}
					</div>
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

				{preparingId && (
					<div className="rounded-2xl border border-orange-500/30 bg-black/80 p-4 space-y-3 backdrop-blur-md shadow-2xl">
						<div className="flex items-center justify-between border-b border-zinc-800 pb-3">
							<div className="flex items-center gap-2">
								<Terminal className="h-4 w-4 text-orange-400" />
								<span className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider">
									Server Preparation Terminal Output ({prepareLogs.length} events)
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 animate-ping rounded-full bg-orange-400" />
								<span className="text-[10px] text-orange-400 font-mono">Live Stream</span>
							</div>
						</div>
						<div className="max-h-56 overflow-y-auto space-y-1.5 font-mono text-xs pr-2">
							{prepareLogs.map((entry, i) => (
								<div key={i} className="flex items-start gap-2">
									<span className="text-orange-500 font-semibold shrink-0">[{entry.stage}]</span>
									<span className={entry.stage === "token" ? "text-emerald-400 break-all" : "text-zinc-300"}>
										{entry.message}
									</span>
								</div>
							))}
							{prepareLogs.length === 0 && (
								<div className="text-zinc-500 italic">
									Initializing SSH connection and bootstrapping container engine...
								</div>
							)}
						</div>
					</div>
				)}

				{prepareDone && (
					<div
						className={`rounded-2xl border p-4 text-xs font-medium ${
							prepareError
								? "border-red-500/40 bg-red-950/20 text-red-400"
								: "border-emerald-500/40 bg-emerald-950/20 text-emerald-400"
						}`}
					>
						{prepareError
							? `Server preparation failed: ${prepareError}`
							: "Node prepared successfully. Container daemon is active and ready for deployments."}
					</div>
				)}
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
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
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
