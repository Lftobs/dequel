import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "../../../hooks/useProjects";
import * as api from "../../../api/client";
import { Card, CardContent } from "../../ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../ui/table";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { StatusBadge } from "../../StatusBadge";
import {
	Trash2,
	X,
	Globe,
	Plus,
	Copy,
	Check,
} from "lucide-react";
import { AddDomainDialog } from "./AddDomainDialog";
import { DeleteDomainDialog } from "./DeleteDomainDialog";
import { DnsInstructionsCard } from "./DnsInstructionsCard";

interface DomainsTabProps {
	projectId: string;
}

export function DomainsTab({
	projectId,
}: DomainsTabProps) {
	const { data: project } =
		useProject(projectId);
	const { data: domains = [], refetch } =
		useQuery({
			queryKey: ["domains", projectId],
			queryFn: () =>
				api.listDomains(projectId),
		});
	const { data: serverIp } = useQuery({
		queryKey: ["server-ip"],
		queryFn: () => api.getServerIp(),
		staleTime: 60_000,
	});
	const { data: domainStatuses, refetch: refetchStatus } = useQuery({
		queryKey: ["domain-status", projectId],
		queryFn: () => api.getDomainStatus(projectId),
		refetchInterval: 30000,
	});
	const [isAddOpen, setIsAddOpen] =
		useState(false);
	const [deletingDomId, setDeletingDomId] =
		useState<string | null>(null);
	const [lastAdded, setLastAdded] =
		useState("");
	const [copiedTarget, setCopiedTarget] =
		useState(false);
	const [domain, setDomain] = useState("");
	const [targetService, setTargetService] = useState("");
	const [targetPort, setTargetPort] = useState("");
	const [isAdding, setIsAdding] = useState(false);

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!domain.trim()) return;
		setIsAdding(true);
		try {
			await api.createDomain(
				projectId,
				domain.trim(),
				"custom",
				targetService.trim() || undefined,
				targetPort.trim() ? Number(targetPort) : undefined,
			);
			setLastAdded(domain.trim());
			setDomain("");
			setTargetService("");
			setTargetPort("");
			setIsAddOpen(false);
			refetch();
			refetchStatus();
		} finally {
			setIsAdding(false);
		}
	};

	const handleDeleteDomain = async () => {
		if (!deletingDomId) return;
		await api.deleteDomain(deletingDomId);
		setDeletingDomId(null);
		refetch();
		refetchStatus();
	};

	const copyText = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedTarget(true);
		setTimeout(
			() => setCopiedTarget(false),
			1500,
		);
	};

	const baseDomain = project?.baseDomain;
	const hasBaseDomain = !!baseDomain;
	const dnsName = lastAdded
		? lastAdded.split(".").length > 2
			? lastAdded.split(".")[0]
			: "@"
		: "";

	const selectedDomToDelete = domains.find(
		(d) => d.id === deletingDomId,
	);

	return (
		<div className="space-y-6">
			{domains.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-12 text-center bg-card/20 backdrop-blur-sm relative overflow-hidden group min-h-[350px]">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
					<div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1a1a1f] to-[#121215] border border-border flex items-center justify-center mb-6 shadow-xl group-hover:border-primary/30 transition-colors duration-300">
						<div className="absolute inset-0 bg-primary/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
						<Globe className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
					</div>
					<h3 className="text-lg font-semibold text-foreground mb-2">
						No Domains Configured
					</h3>
					<p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
						Point web traffic to your
						container deployments.
						Attach custom domain
						addresses with automatic
						Let's Encrypt SSL
						provisioning.
					</p>
					<Button
						onClick={() =>
							setIsAddOpen(true)
						}
						className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-5 h-10 rounded-xl transition-all shadow-lg hover:shadow-primary/20"
					>
						<Plus className="h-4 w-4" />{" "}
						Add Custom Domain
					</Button>
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								Domains
							</h2>
							<p className="text-sm text-muted-foreground">
								Domains and subdomains linked to project endpoints.
							</p>
						</div>
						<Button
							onClick={() =>
								setIsAddOpen(true)
							}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs shadow-md w-full sm:w-auto"
						>
							<Plus className="h-4.5 w-4.5" />{" "}
							Add Domain
						</Button>
					</div>

					{lastAdded && (
						<DnsInstructionsCard
							lastAdded={lastAdded}
							onDismiss={() => setLastAdded("")}
							hasBaseDomain={hasBaseDomain}
							dnsName={dnsName}
							baseDomain={baseDomain}
							serverIp={serverIp}
							copiedTarget={copiedTarget}
							onCopy={copyText}
						/>
					)}

					<div className="rounded-xl border border-border bg-card/35 backdrop-blur-sm overflow-hidden">
						{/* Mobile Card List View (< md) */}
						<div className="md:hidden divide-y divide-border">
							{domains.map((d) => {
								const st = domainStatuses?.find((s) => s.domain === d.domain);
								return (
									<div key={d.id} className="p-3.5 space-y-2.5">
										<div className="flex items-center justify-between gap-2">
											<span className="font-semibold text-foreground text-sm break-all">
												{d.domain}
											</span>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
												onClick={() => setDeletingDomId(d.id)}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
										<div className="flex flex-wrap items-center gap-2 text-xs">
											<Badge
												variant="outline"
												className="text-[10px] uppercase border-border text-muted-foreground bg-secondary/10 px-2 py-0.5"
											>
												{d.type}
											</Badge>
											<StatusBadge status={d.validationStatus} />
											<StatusBadge status={d.sslStatus} />
										</div>
										{st && (
											<div className="flex items-center gap-4 text-xs pt-1 border-t border-border/40">
												<span className="inline-flex items-center gap-1.5">
													<span className={`h-1.5 w-1.5 rounded-full ${st.dnsOk ? "bg-emerald-400" : "bg-red-400"}`} />
													<span className={st.dnsOk ? "text-emerald-400 text-[11px]" : "text-red-400 text-[11px]"}>
														DNS {st.dnsOk ? "Resolved" : "Unresolved"}
													</span>
												</span>
												<span className="inline-flex items-center gap-1.5">
													<span className={`h-1.5 w-1.5 rounded-full ${st.tlsOk ? "bg-emerald-400" : "bg-amber-400"}`} />
													<span className={st.tlsOk ? "text-emerald-400 text-[11px]" : "text-amber-400 text-[11px]"}>
														TLS {st.tlsOk ? "Secured" : "Pending"}
													</span>
												</span>
											</div>
										)}
									</div>
								);
							})}
						</div>

						{/* Desktop Table View (>= md) */}
						<div className="hidden md:block overflow-x-auto">
							<Table className="w-full">
								<TableHeader className="bg-[#0b0b0f]/50">
									<TableRow className="border-border hover:bg-transparent">
										<TableHead className="text-xs font-semibold py-3">
											Domain
										</TableHead>
										<TableHead className="text-xs font-semibold py-3">
											Type
										</TableHead>
										<TableHead className="text-xs font-semibold py-3">
											Validation
										</TableHead>
										<TableHead className="text-xs font-semibold py-3">
											SSL
										</TableHead>
										<TableHead className="text-xs font-semibold py-3">
											DNS
										</TableHead>
										<TableHead className="text-xs font-semibold py-3">
											TLS
										</TableHead>
										<TableHead className="w-12 text-right pr-6"></TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{domains.map(
										(d) => (
											<TableRow
												key={
													d.id
												}
												className="border-border hover:bg-[#121217]/30 group transition-all"
											>
												<TableCell className="font-semibold py-3.5 text-foreground">
													{
														d.domain
													}
												</TableCell>
												<TableCell className="py-3.5">
													<Badge
														variant="outline"
														className="text-[10px] uppercase border-border text-muted-foreground bg-secondary/10 px-2 py-0.5"
													>
														{
															d.type
														}
													</Badge>
												</TableCell>
												<TableCell className="py-3.5">
													<StatusBadge
														status={
															d.validationStatus
														}
													/>
												</TableCell>
												<TableCell className="py-3.5">
													<StatusBadge
														status={
															d.sslStatus
														}
													/>
												</TableCell>
												{(() => {
													const st = domainStatuses?.find(
														(s) => s.domain === d.domain,
													);
													return (
														<>
															<TableCell className="py-3.5">
																{st ? (
																	<span className="inline-flex items-center gap-1.5 text-xs">
																		<span className={`h-1.5 w-1.5 rounded-full ${st.dnsOk ? "bg-emerald-400" : "bg-red-400"}`} />
																		<span className={st.dnsOk ? "text-emerald-400" : "text-red-400"}>
																			{st.dnsOk ? "Resolved" : "Unresolved"}
																		</span>
																	</span>
																) : (
																	<span className="text-xs text-muted-foreground">—</span>
																)}
															</TableCell>
															<TableCell className="py-3.5">
																{st ? (
																	<span className="inline-flex items-center gap-1.5 text-xs">
																		<span className={`h-1.5 w-1.5 rounded-full ${st.tlsOk ? "bg-emerald-400" : "bg-amber-400"}`} />
																		<span className={st.tlsOk ? "text-emerald-400" : "text-amber-400"}>
																			{st.tlsOk ? "Secured" : "Pending"}
																		</span>
																	</span>
																) : (
																	<span className="text-xs text-muted-foreground">—</span>
																)}
															</TableCell>
														</>
													);
												})()}
												<TableCell className="py-3.5 pr-6 text-right">
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-80 group-hover:opacity-100"
														onClick={() =>
															setDeletingDomId(
																d.id,
															)
														}
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</TableCell>
											</TableRow>
										),
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				</div>
			)}

			{/* Add Domain Dialog */}
			<AddDomainDialog
				open={isAddOpen}
				onOpenChange={setIsAddOpen}
				domain={domain}
				setDomain={setDomain}
				targetService={targetService}
				setTargetService={setTargetService}
				targetPort={targetPort}
				setTargetPort={setTargetPort}
				isCompose={(project as any)?.buildType === "compose"}
				isAdding={isAdding}
				onAdd={add}
			/>

			{/* Delete Domain Confirmation Dialog */}
			<DeleteDomainDialog
				domain={selectedDomToDelete?.domain}
				open={deletingDomId !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingDomId(null);
				}}
				onConfirm={handleDeleteDomain}
			/>
		</div>
	);
}
