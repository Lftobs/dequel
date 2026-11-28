import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText, Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import * as api from "../api/client";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import type { AuditLog } from "../types";

const PAGE_SIZE = 50;

const formatDetails = (details: Record<string, unknown>) => {
	const entries = Object.entries(details ?? {});
	if (entries.length === 0) return "—";
	return entries
		.slice(0, 3)
		.map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
		.join(", ");
};

export function AuditLogs() {
	const [offset, setOffset] = useState(0);
	const [action, setAction] = useState("");
	const [resourceType, setResourceType] = useState("");
	const [actorType, setActorType] = useState("");
	const [appliedFilters, setAppliedFilters] = useState({ action: "", resourceType: "", actorType: "" });

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["audit-logs", appliedFilters, offset],
		queryFn: () =>
			api.listAuditLogs({
				limit: PAGE_SIZE,
				offset,
				action: appliedFilters.action || undefined,
				resourceType: appliedFilters.resourceType || undefined,
				actorType: appliedFilters.actorType || undefined,
			}),
	});

	const items: AuditLog[] = data?.items ?? [];
	const total = data?.total ?? 0;
	const page = Math.floor(offset / PAGE_SIZE) + 1;
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const applyFilters = () => {
		setOffset(0);
		setAppliedFilters({ action: action.trim(), resourceType: resourceType.trim(), actorType: actorType.trim() });
	};

	const resetFilters = () => {
		setAction("");
		setResourceType("");
		setActorType("");
		setAppliedFilters({ action: "", resourceType: "", actorType: "" });
		setOffset(0);
	};

	return (
		<div className="mx-auto max-w-6xl space-y-6 pb-12">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
						<ScrollText className="h-6 w-6 text-orange-500" />
						Audit Logs
					</h1>
					<p className="mt-1 text-xs text-muted-foreground">
						Every privileged action across the platform, with actor, resource, and request metadata.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isFetching}
					className="gap-1.5 border-border/60 text-xs self-start sm:self-auto"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
					Refresh
				</Button>
			</div>

			<Card className="border-border/60 bg-card/60 backdrop-blur-sm">
				<CardHeader className="border-b border-border/40 pb-4">
					<CardTitle className="text-sm font-semibold text-foreground">Filters</CardTitle>
				</CardHeader>
				<CardContent className="pt-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
						<Input
							placeholder="Action (e.g. project.created)"
							value={action}
							onChange={(e) => setAction(e.target.value)}
							className="bg-card border-border/80 text-xs font-mono"
						/>
						<Input
							placeholder="Resource type (e.g. project)"
							value={resourceType}
							onChange={(e) => setResourceType(e.target.value)}
							className="bg-card border-border/80 text-xs font-mono"
						/>
						<Input
							placeholder="Actor type (e.g. user, api_key)"
							value={actorType}
							onChange={(e) => setActorType(e.target.value)}
							className="bg-card border-border/80 text-xs font-mono"
						/>
						<div className="flex gap-2">
							<Button
								onClick={applyFilters}
								size="sm"
								className="flex-1 gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs"
							>
								<Search className="h-3.5 w-3.5" />
								Apply
							</Button>
							<Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">
								Reset
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{items.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-16 text-center">
					<ShieldAlert className="h-8 w-8 text-muted-foreground mb-3" />
					<h3 className="text-sm font-semibold text-foreground">No Audit Events</h3>
					<p className="text-xs text-muted-foreground max-w-sm mt-1">
						{total === 0 && !appliedFilters.action && !appliedFilters.resourceType && !appliedFilters.actorType
							? "Actions will appear here as users and API tokens interact with the platform."
							: "No events match the current filters."}
					</p>
				</div>
			) : (
				<>
					<div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
						<div className="md:hidden divide-y divide-border/40">
							{items.map((log) => (
								<div key={log.id} className="p-3.5 space-y-2">
									<div className="flex items-center justify-between gap-2">
										<span className="font-mono text-xs text-orange-400 break-all">{log.action}</span>
										<Badge variant="outline" className="text-[10px] shrink-0">
											{log.resourceType}
										</Badge>
									</div>
									<p className="text-[11px] text-muted-foreground break-all">{formatDetails(log.details)}</p>
									<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/80">
										<span>
											{log.actorType}:{log.actorId.slice(0, 12)}
										</span>
										{log.resourceId && <span className="font-mono">#{log.resourceId.slice(0, 8)}</span>}
										<span>{new Date(log.createdAt).toLocaleString()}</span>
									</div>
									{log.ipAddress && <p className="text-[10px] font-mono text-muted-foreground/60">{log.ipAddress}</p>}
								</div>
							))}
						</div>

						<div className="hidden md:block overflow-x-auto">
							<Table className="w-full">
								<TableHeader className="bg-muted/40">
									<TableRow className="border-border/60 hover:bg-transparent">
										<TableHead className="text-xs font-semibold">Time</TableHead>
										<TableHead className="text-xs font-semibold">Action</TableHead>
										<TableHead className="text-xs font-semibold">Actor</TableHead>
										<TableHead className="text-xs font-semibold">Resource</TableHead>
										<TableHead className="text-xs font-semibold">Details</TableHead>
										<TableHead className="text-xs font-semibold">IP</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((log) => (
										<TableRow key={log.id} className="border-border/40 hover:bg-muted/20">
											<TableCell className="text-[11px] text-muted-foreground py-3 whitespace-nowrap">
												{new Date(log.createdAt).toLocaleString()}
											</TableCell>
											<TableCell className="font-mono text-xs text-orange-400 py-3">{log.action}</TableCell>
											<TableCell className="text-xs py-3">
												<span className="text-muted-foreground">{log.actorType}</span>
												<span className="block font-mono text-[10px] text-muted-foreground/70">
													{log.actorId.slice(0, 16)}
												</span>
											</TableCell>
											<TableCell className="text-xs py-3">
												<Badge variant="outline" className="text-[10px]">
													{log.resourceType}
												</Badge>
												{log.resourceId && (
													<span className="block font-mono text-[10px] text-muted-foreground/70 mt-1">
														{log.resourceId.slice(0, 16)}
													</span>
												)}
											</TableCell>
											<TableCell className="text-[11px] text-muted-foreground py-3 max-w-[260px] truncate">
												{formatDetails(log.details)}
											</TableCell>
											<TableCell className="font-mono text-[10px] text-muted-foreground/70 py-3">
												{log.ipAddress || "—"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>

					<div className="flex items-center justify-between gap-3">
						<p className="text-[11px] text-muted-foreground">
							Page {page} of {pages} · {total} event{total === 1 ? "" : "s"}
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={offset === 0 || isFetching}
								onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
								className="border-border/60 text-xs gap-1"
							>
								<ChevronLeft className="h-3.5 w-3.5" />
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={offset + PAGE_SIZE >= total || isFetching}
								onClick={() => setOffset(offset + PAGE_SIZE)}
								className="border-border/60 text-xs gap-1"
							>
								Next
								<ChevronRight className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
