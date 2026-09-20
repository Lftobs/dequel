import { Check, Copy, HardDrive, KeyRound, ShieldAlert, Wifi } from "lucide-react";
import { useState } from "react";
import * as api from "../../../api/client";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

interface AddServerFormProps {
	sshKeys: Array<{ id: string; name: string; fingerprint?: string | null }>;
	onServerAdded: () => void;
	onCancel: () => void;
}

export function AddServerForm({ sshKeys, onServerAdded, onCancel }: AddServerFormProps) {
	const [activeTab, setActiveTab] = useState<"ssh" | "agent">("ssh");
	const [name, setName] = useState("");
	const [host, setHost] = useState("");
	const [port, setPort] = useState("22");
	const [sshUser, setSshUser] = useState("root");
	const [selectedKeyId, setSelectedKeyId] = useState("");
	const [agentName, setAgentName] = useState("");
	const [registrationCommand, setRegistrationCommand] = useState("");
	const [registrationError, setRegistrationError] = useState("");
	const [copiedCommand, setCopiedCommand] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const addSshServer = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !host.trim()) return;
		setIsSubmitting(true);
		try {
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
			onServerAdded();
		} catch (err) {
			console.error("Failed to add SSH server", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const createRegistration = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!agentName.trim()) return;
		setRegistrationError("");
		setIsSubmitting(true);
		try {
			const result = await api.createAgentRegistrationToken({ name: agentName.trim() });
			const controlPlane = window.location.origin;
			setRegistrationCommand(
				`docker run -d --name dequel-agent --cap-add=NET_ADMIN --device /dev/net/tun --restart unless-stopped -e DEQUEL_CONTROL_PLANE=${controlPlane} -e DEQUEL_REGISTRATION_TOKEN=${result.token} -v dequel-agent-data:/root/.dequel -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/lftobs/dequel/agent:latest`,
			);
		} catch (err) {
			setRegistrationError(err instanceof Error ? err.message : "Could not create registration token");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCopyCommand = () => {
		if (!registrationCommand) return;
		navigator.clipboard.writeText(registrationCommand);
		setCopiedCommand(true);
		setTimeout(() => setCopiedCommand(false), 2000);
	};

	return (
		<div className="rounded-2xl border border-border/80 bg-background/40 p-4 sm:p-5 space-y-5 shadow-inner">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Select Connection Method
				</span>
				<div className="flex rounded-xl bg-black/40 p-1 border border-border/60">
					<button
						type="button"
						onClick={() => setActiveTab("ssh")}
						className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
							activeTab === "ssh" ? "bg-orange-500 text-white shadow" : "text-muted-foreground hover:text-foreground"
						}`}
					>
						<HardDrive className="h-3.5 w-3.5" />
						Direct SSH
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("agent")}
						className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
							activeTab === "agent" ? "bg-orange-500 text-white shadow" : "text-muted-foreground hover:text-foreground"
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

					<div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-border/40">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onCancel}
							className="text-xs text-muted-foreground"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={isSubmitting}
							className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-4"
						>
							{isSubmitting ? "Adding..." : "Add SSH Server"}
						</Button>
					</div>
				</form>
			) : (
				<form onSubmit={createRegistration} className="space-y-4">
					<p className="text-xs text-muted-foreground leading-relaxed">
						Deploy a lightweight agent for firewalled nodes or local homelabs behind NAT. Establishes a secure P2P WireGuard tunnel.
					</p>
					<div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
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
							disabled={isSubmitting}
							className="text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10 w-full sm:w-auto"
						>
							{isSubmitting ? "Generating..." : "Generate Agent Command"}
						</Button>
					</div>

					{registrationCommand && (
						<div className="space-y-2 pt-2">
							<div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
								<span>Run Docker Command on Target Server</span>
							</div>
							<div className="relative rounded-2xl border border-border/80 bg-black/60 p-4 font-mono text-xs text-zinc-300">
								<p className="break-all sm:pr-20 pb-10 sm:pb-0">{registrationCommand}</p>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleCopyCommand}
									className="absolute right-3 bottom-3 sm:bottom-auto sm:top-3 h-8 bg-card/80 hover:bg-card text-xs text-zinc-300 gap-1.5 px-3 rounded-lg border border-border/40"
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
	);
}
