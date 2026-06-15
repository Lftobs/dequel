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
import { Input } from "../../ui/input";
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
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../../ui/dialog";

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
	const [isAddOpen, setIsAddOpen] =
		useState(false);
	const [deletingDomId, setDeletingDomId] =
		useState<string | null>(null);
	const [lastAdded, setLastAdded] =
		useState("");
	const [copiedTarget, setCopiedTarget] =
		useState(false);
	const [domain, setDomain] = useState("");
	const [isAdding, setIsAdding] =
		useState(false);

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!domain.trim()) return;
		setIsAdding(true);
		try {
			await api.createDomain(
				projectId,
				domain.trim(),
			);
			setLastAdded(domain.trim());
			setDomain("");
			setIsAddOpen(false);
			refetch();
		} finally {
			setIsAdding(false);
		}
	};

	const handleDeleteDomain = async () => {
		if (!deletingDomId) return;
		await api.deleteDomain(deletingDomId);
		setDeletingDomId(null);
		refetch();
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
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								Domains
							</h2>
							<p className="text-sm text-muted-foreground">
								Domains and
								subdomains linked
								to project
								endpoints.
							</p>
						</div>
						<Button
							onClick={() =>
								setIsAddOpen(true)
							}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs shadow-md"
						>
							<Plus className="h-4.5 w-4.5" />{" "}
							Add Domain
						</Button>
					</div>

					{lastAdded && (
						<Card className="border-primary/30 bg-primary/5 shadow-md shadow-primary/5">
							<CardContent className="p-5 relative">
								<Button
									variant="ghost"
									size="icon"
									className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
									onClick={() =>
										setLastAdded(
											"",
										)
									}
								>
									<X className="h-4 w-4" />
								</Button>
								<div className="flex items-start gap-3.5">
									<Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
									<div className="space-y-2.5 text-sm w-full">
										<p className="font-semibold text-foreground">
											DNS
											Configuration
											Required
											for{" "}
											<code className="text-primary font-mono">
												{
													lastAdded
												}
											</code>
										</p>
										{hasBaseDomain ? (
											<>
												<p className="text-xs text-muted-foreground">
													Add
													a
													CNAME
													record
													at
													your
													DNS
													domain
													registrar:
												</p>
												<div className="rounded-lg border border-border bg-[#070709] overflow-hidden text-[10px] font-mono w-full">
													<table className="w-full">
														<thead>
															<tr className="bg-[#0b0b0f] text-left">
																<th className="px-3 py-1.5 text-muted-foreground font-semibold">
																	Type
																</th>
																<th className="px-3 py-1.5 text-muted-foreground font-semibold">
																	Host/Name
																</th>
																<th className="px-3 py-1.5 text-muted-foreground font-semibold">
																	Target/Value
																</th>
															</tr>
														</thead>
														<tbody>
															<tr className="border-t border-border/40">
																<td className="px-3 py-2 text-foreground font-bold">
																	CNAME
																</td>
																<td className="px-3 py-2 text-foreground">
																	{
																		dnsName
																	}
																</td>
																<td className="px-3 py-2 text-foreground flex items-center justify-between">
																	<span className="truncate max-w-[200px]">
																		{
																			baseDomain
																		}
																	</span>
																	<button
																		type="button"
																		onClick={() =>
																			copyText(
																				baseDomain,
																			)
																		}
																		className={`p-1 transition-colors ${copiedTarget ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
																	>
																		{copiedTarget ? (
																			<Check className="h-3 w-3" />
																		) : (
																			<Copy className="h-3 w-3" />
																		)}
																	</button>
																</td>
															</tr>
														</tbody>
													</table>
												</div>
												<p className="text-xs text-muted-foreground">
													Or
													point
													an
													A
													record
													directly
													to
													target
													IP:{" "}
													<code className="text-primary font-mono font-bold bg-[#0d0d11] px-1.5 py-0.5 rounded border border-border/50">
														{serverIp?.ip ??
															"../.."}
													</code>
												</p>
											</>
										) : (
											<>
												<p className="text-xs text-muted-foreground">
													Add
													an
													A
													record
													at
													your
													DNS
													domain
													registrar:
												</p>
												<div className="rounded-lg border border-border bg-[#070709] overflow-hidden text-[10px] font-mono w-full">
													<table className="w-full">
														<thead>
															<tr className="bg-[#0b0b0f] text-left">
																<th className="px-3 py-1.5 text-muted-foreground font-semibold">
																	Type
																</th>
																<th className="px-3 py-1.5 text-muted-foreground font-semibold">
																	Host/Name
																</th>
																<th className="px-3 py-1.5 text-muted-foreground font-semibold">
																	Value
																</th>
															</tr>
														</thead>
														<tbody>
															<tr className="border-t border-border/40">
																<td className="px-3 py-2 text-foreground font-bold">
																	A
																</td>
																<td className="px-3 py-2 text-foreground">
																	{
																		dnsName
																	}
																</td>
																<td className="px-3 py-2 text-foreground flex items-center justify-between">
																	<span>
																		{serverIp?.ip ??
																			"../.."}
																	</span>
																	{serverIp?.ip && (
																		<button
																			type="button"
																			onClick={() =>
																				copyText(
																					serverIp.ip,
																				)
																			}
																			className={`p-1 transition-colors ${copiedTarget ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
																		>
																			{copiedTarget ? (
																				<Check className="h-3 w-3" />
																			) : (
																				<Copy className="h-3 w-3" />
																			)}
																		</button>
																	)}
																</td>
															</tr>
														</tbody>
													</table>
												</div>
											</>
										)}
										<p className="text-[10px] text-muted-foreground/80 leading-relaxed">
											DNS
											changes
											can
											take
											up to
											48
											hours
											to
											propagate
											globally.
											Dequel
											will
											validate
											ssl
											cert
											status
											automatically.
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					<div className="rounded-xl border border-border bg-card/35 backdrop-blur-sm overflow-hidden">
						<Table>
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
			)}

			{/* Add Domain Dialog */}
			<Dialog
				open={isAddOpen}
				onOpenChange={setIsAddOpen}
			>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Add Custom Domain
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Attach domain
							endpoints to route
							external web requests
							to your container
							proxy.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={add}
						className="space-y-4 pt-2"
					>
						<div className="grid gap-2">
							<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Domain Address
							</label>
							<Input
								placeholder="e.g. app.mycompany.com"
								value={domain}
								onChange={(e) =>
									setDomain(
										e.target
											.value,
									)
								}
								className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg font-mono"
								required
							/>
						</div>

						<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
							<Button
								type="button"
								variant="ghost"
								onClick={() =>
									setIsAddOpen(
										false,
									)
								}
								className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
								disabled={
									isAdding
								}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={
									isAdding
								}
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all"
							>
								{isAdding
									? "Adding..."
									: "Add Domain"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Delete Domain Confirmation Dialog */}
			<Dialog
				open={deletingDomId !== null}
				onOpenChange={(open) =>
					!open &&
					setDeletingDomId(null)
				}
			>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Remove Domain
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Are you sure you want
							to remove domain{" "}
							<span className="font-semibold text-foreground font-mono">
								{
									selectedDomToDelete?.domain
								}
							</span>
							? This will stop
							routing incoming
							traffic from this path
							to your running
							container service.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() =>
								setDeletingDomId(
									null,
								)
							}
							className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							onClick={
								handleDeleteDomain
							}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs h-9 px-4 rounded-lg transition-all"
						>
							Remove Domain
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
