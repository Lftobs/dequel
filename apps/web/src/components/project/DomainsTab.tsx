import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "../../hooks/useProjects";
import * as api from "../../api/client";
import { Card, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { StatusBadge } from "../StatusBadge";
import { Trash2, X, Globe } from "lucide-react";

interface DomainsTabProps {
	projectId: string;
}

export function DomainsTab({ projectId }: DomainsTabProps) {
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
	const [domain, setDomain] = useState("");
	const [lastAdded, setLastAdded] =
		useState("");

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!domain.trim()) return;
		await api.createDomain(
			projectId,
			domain.trim(),
		);
		setLastAdded(domain.trim());
		setDomain("");
		refetch();
	};

	const baseDomain = project?.baseDomain;
	const hasBaseDomain = !!baseDomain;
	const dnsName = lastAdded
		? lastAdded.split(".").length > 2
			? lastAdded.split(".")[0]
			: "@"
		: "";

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="pt-6">
					<form
						onSubmit={add}
						className="flex gap-2"
					>
						<Input
							placeholder="e.g. app.mycompany.com"
							value={domain}
							onChange={(e) =>
								setDomain(
									e.target
										.value,
								)
							}
							className="flex-1"
						/>
						<Button
							type="submit"
							size="sm"
						>
							Add Domain
						</Button>
					</form>
				</CardContent>
			</Card>

			{lastAdded && (
				<Card className="border-primary/30 bg-primary/5">
					<CardContent className="pt-6 pb-4 relative">
						<Button
							variant="ghost"
							size="icon"
							className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
							onClick={() =>
								setLastAdded("")
							}
						>
							<X className="h-3.5 w-3.5" />
						</Button>
						<div className="flex items-start gap-3">
							<Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
							<div className="space-y-2 text-sm">
								<p className="font-medium text-foreground">
									Configure DNS
									for{" "}
									<code className="text-primary">
										{
											lastAdded
										}
									</code>
								</p>
								{hasBaseDomain ? (
									<>
										<p className="text-muted-foreground">
											Add a
											CNAME
											record
											at
											your
											DNS
											provider:
										</p>
										<div className="rounded-md border border-border bg-card overflow-hidden text-xs font-mono">
											<table className="w-full">
												<thead>
													<tr className="bg-muted text-left">
														<th className="px-3 py-1.5 text-muted-foreground font-medium">
															Type
														</th>
														<th className="px-3 py-1.5 text-muted-foreground font-medium">
															Name
														</th>
														<th className="px-3 py-1.5 text-muted-foreground font-medium">
															Target
														</th>
													</tr>
												</thead>
												<tbody>
													<tr className="border-t border-border">
														<td className="px-3 py-1.5 text-foreground">
															CNAME
														</td>
														<td className="px-3 py-1.5 text-foreground">
															{
																dnsName
															}
														</td>
														<td className="px-3 py-1.5 text-foreground">
															{
																baseDomain
															}
														</td>
													</tr>
												</tbody>
											</table>
										</div>
										<p className="text-muted-foreground">
											Or use
											an A
											record
											pointing
											to{" "}
											<code className="text-primary font-mono">
												{serverIp?.ip ??
													"…"}
											</code>
										</p>
									</>
								) : (
									<>
										<p className="text-muted-foreground">
											Add an
											A
											record
											at
											your
											DNS
											provider:
										</p>
										<div className="rounded-md border border-border bg-card overflow-hidden text-xs font-mono">
											<table className="w-full">
												<thead>
													<tr className="bg-muted text-left">
														<th className="px-3 py-1.5 text-muted-foreground font-medium">
															Type
														</th>
														<th className="px-3 py-1.5 text-muted-foreground font-medium">
															Name
														</th>
														<th className="px-3 py-1.5 text-muted-foreground font-medium">
															Value
														</th>
													</tr>
												</thead>
												<tbody>
													<tr className="border-t border-border">
														<td className="px-3 py-1.5 text-foreground">
															A
														</td>
														<td className="px-3 py-1.5 text-foreground">
															{
																dnsName
															}
														</td>
														<td className="px-3 py-1.5 text-foreground">
															{serverIp?.ip ??
																"(resolving server IP…)"}
														</td>
													</tr>
												</tbody>
											</table>
										</div>
									</>
								)}
								<p className="text-muted-foreground text-xs pt-1">
									DNS changes
									can take up to
									48 hours to
									propagate.
									Validation
									checks for
									CNAME or A
									records.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{domains.length > 0 && (
				<div className="rounded-xl border border-border bg-card overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									Domain
								</TableHead>
								<TableHead>
									Type
								</TableHead>
								<TableHead>
									Validation
								</TableHead>
								<TableHead>
									SSL
								</TableHead>
								<TableHead className="w-12"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{domains.map((d) => (
								<TableRow
									key={d.id}
								>
									<TableCell className="font-medium">
										{d.domain}
									</TableCell>
									<TableCell>
										<Badge variant="secondary">
											{
												d.type
											}
										</Badge>
									</TableCell>
									<TableCell>
										<StatusBadge
											status={
												d.validationStatus
											}
										/>
									</TableCell>
									<TableCell>
										<StatusBadge
											status={
												d.sslStatus
											}
										/>
									</TableCell>
									<TableCell>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-muted-foreground hover:text-destructive"
											onClick={() =>
												api
													.deleteDomain(
														d.id,
													)
													.then(
														() =>
															refetch(),
													)
											}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
