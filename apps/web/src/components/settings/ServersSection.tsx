import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { StatusBadge } from "../StatusBadge";
import { Trash2, Server, Copy } from "lucide-react";
import * as api from "../../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";

export function ServersSection() {
	const { data: servers = [], refetch } = useQuery({
		queryKey: ["servers"],
		queryFn: () => api.listServers().catch(() => []),
	});
	const [name, setName] = useState("");
	const [host, setHost] = useState("");
	const [port, setPort] = useState("22");
	const [sshUser, setSshUser] = useState("root");
	const [sshKey, setSshKey] = useState("");
	const [agentName, setAgentName] = useState("");
	const [registrationCommand, setRegistrationCommand] = useState("");
	const [registrationError, setRegistrationError] = useState("");

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
				setPrepareError(event.ok ? null : (event.error || "Preparation failed"));
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
			sshKey: sshKey.trim() || undefined,
		});
		setName("");
		setHost("");
		setPort("22");
		setSshUser("root");
		setSshKey("");
		refetch();
	};

	const createRegistration = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!agentName.trim()) return;
		setRegistrationError("");
		try {
			const result = await api.createAgentRegistrationToken({ name: agentName.trim() });
			const controlPlane = window.location.origin;
			setRegistrationCommand(`docker run -d --name dequel-agent --cap-add=NET_ADMIN --device /dev/net/tun --restart unless-stopped -e DEQUEL_CONTROL_PLANE=${controlPlane} -e DEQUEL_REGISTRATION_TOKEN=${result.token} -v dequel-agent-data:/root/.dequel -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/lftobs/dequel/agent:latest`);
		} catch (err) {
			setRegistrationError(err instanceof Error ? err.message : "Could not create registration token");
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Server className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-lg">Servers</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<form onSubmit={addSshServer} className="mb-5 rounded-lg border border-border bg-black/20 p-4">
					<div className="mb-3 flex items-start gap-3">
						<Server className="mt-0.5 h-4 w-4 text-orange-500" />
						<div>
							<h3 className="text-sm font-semibold">Connect a Server (Direct SSH)</h3>
							<p className="mt-1 text-xs text-muted-foreground">Add any remote cloud VPS (Hetzner, DigitalOcean, AWS). Dequel deploys over SSH directly without installing software on the target server.</p>
						</div>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">Server Name</label>
							<Input placeholder="prod-node-1" value={name} onChange={(e) => setName(e.target.value)} />
						</div>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">Host / IP Address</label>
							<Input placeholder="192.168.1.10" value={host} onChange={(e) => setHost(e.target.value)} />
						</div>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">SSH Port</label>
							<Input type="number" placeholder="22" value={port} onChange={(e) => setPort(e.target.value)} />
						</div>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">SSH User</label>
							<Input placeholder="root" value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
						</div>
					</div>
					<div className="mt-3 grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">SSH Private Key <span className="text-muted-foreground/60">(optional — paste PEM content)</span></label>
						<textarea
							className="min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
							placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
							value={sshKey}
							onChange={(e) => setSshKey(e.target.value)}
						/>
					</div>
					<div className="mt-4 flex justify-end">
						<Button type="submit" size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">Add SSH Server</Button>
					</div>
				</form>

				<details className="mb-4 rounded-lg border border-border px-4 py-3">
					<summary className="cursor-pointer text-xs font-medium text-muted-foreground">Alternative: Direct P2P WireGuard Agent (For Firewalled Nodes)</summary>
					<form onSubmit={createRegistration} className="mt-3 space-y-3">
						<p className="text-xs text-muted-foreground">Establishes an encrypted Direct P2P WireGuard tunnel for firewalled nodes or homelabs without open SSH ports.</p>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
							<div className="grid flex-1 gap-1.5">
								<label htmlFor="agent-server-name" className="text-xs font-medium text-muted-foreground">Agent Server Name</label>
								<Input id="agent-server-name" placeholder="homelab-node" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
							</div>
							<Button type="submit" size="sm" variant="outline">Generate P2P Agent Command</Button>
						</div>
						{registrationCommand && (
							<div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-background p-3">
								<code className="min-w-0 flex-1 break-all text-xs text-zinc-300">{registrationCommand}</code>
								<Button type="button" variant="ghost" size="icon" aria-label="Copy registration command" onClick={() => navigator.clipboard.writeText(registrationCommand)}>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
						)}
						{registrationError && <p role="alert" className="mt-2 text-xs text-red-400">{registrationError}</p>}
					</form>
				</details>
				{servers.length > 0 && (
					<div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
						<Table className="min-w-[500px] md:min-w-full">
							<TableHeader>
								<TableRow><TableHead>Name</TableHead><TableHead>Host / Connection</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead><TableHead className="w-12"></TableHead></TableRow>
							</TableHeader>
							<TableBody>
								{servers.map((s) => (
									<TableRow key={s.id}>
										<TableCell className="font-medium">{s.name}</TableCell>
										<TableCell className="font-mono text-xs">{s.mode === "agent" ? `P2P WireGuard Agent ${s.agentVersion || ""}` : `SSH (${s.sshUser || "root"}@${s.host}:${s.port})${s.sshKey ? " [key]" : ""}`}</TableCell>
										<TableCell><StatusBadge status={s.status || "active"} /></TableCell>
										<TableCell className="text-right">
											{s.mode !== "local" && (
												<Button variant="outline" size="sm" className="h-7 text-xs"
													disabled={preparingId !== null}
													onClick={() => handlePrepare(s.id)}>
													{preparingId === s.id ? "Preparing..." : "Prepare"}
												</Button>
											)}
										</TableCell>
										<TableCell className="text-right">
											<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
												onClick={() => setDeletingServerId(s.id)}>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
				{preparingId && (
					<div className="mt-4 rounded-lg border border-border bg-black/30 p-3">
						<div className="mb-2 flex items-center gap-2">
							<div className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
							<span className="text-xs font-medium text-foreground">Preparing server... {prepareLogs.length} steps</span>
						</div>
						<div className="max-h-52 overflow-y-auto space-y-1 font-mono text-[11px]">
							{prepareLogs.map((entry, i) => (
								<div key={i} className={entry.stage === "token" ? "text-emerald-400/90 break-all" : "text-zinc-400"}>
									<span className="text-orange-500/80">[{entry.stage}]</span> {entry.message}
								</div>
							))}
							{prepareLogs.length === 0 && <div className="text-zinc-600">Waiting for connection...</div>}
						</div>
					</div>
				)}
				{prepareDone && (
					<div className={`mt-4 rounded-lg border p-3 text-xs ${prepareError ? "border-red-500/40 text-red-400" : "border-emerald-500/40 text-emerald-400"}`}>
						{prepareError ? `Preparation failed: ${prepareError}` : "Server prepared successfully. You can now deploy to it."}
					</div>
				)}
			</CardContent>

			<Dialog open={deletingServerId !== null} onOpenChange={(open) => { if (!open) setDeletingServerId(null); }}>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">Remove Server</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Are you sure you want to remove this server from the cluster? This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button variant="ghost" onClick={() => setDeletingServerId(null)}
							className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]">Cancel</Button>
						<Button onClick={handleDeleteServer}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all">Remove Server</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
