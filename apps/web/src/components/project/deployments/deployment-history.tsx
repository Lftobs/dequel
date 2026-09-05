import { ChevronLeft, ChevronRight, History, RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/utils";
import { StatusBadge } from "../../StatusBadge";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DeploymentDuration, DeploymentLogs, depDisplayName, formatTimeAgo } from "./deployment-logs";

interface DeploymentHistoryProps {
	deployments: any[];
	page: number;
	totalPages: number;
	totalDeployments: number;
	projectName: string | undefined;
	onPageChange: (page: number) => void;
	onSelect: (id: string | null) => void;
	selectedId: string | null;
	onRedeploy: (id: string) => void;
	onRollback: (id: string) => void;
	onCancel: (id: string) => void;
	onDelete: (id: string) => void;
}

export function DeploymentHistory({
	deployments,
	page,
	totalPages,
	totalDeployments,
	projectName,
	onPageChange,
	onSelect,
	selectedId,
	onRedeploy,
	onRollback,
	onCancel,
	onDelete,
}: DeploymentHistoryProps) {
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

	const selectedDeployment = deployments.find((d) => d.id === selectedId);

	return (
		<>
			<div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
				<Table className="min-w-[650px] md:min-w-full">
					<TableHeader>
						<TableRow>
							<TableHead>Status</TableHead>
							<TableHead>Deployment</TableHead>
							<TableHead>Source</TableHead>
							<TableHead>Branch</TableHead>
							<TableHead>Duration</TableHead>
							<TableHead>Age</TableHead>
							<TableHead className="w-24"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{deployments.map((dep) => (
							<TableRow
								key={dep.id}
								className={cn("cursor-pointer transition-all", selectedId === dep.id && "bg-primary/5")}
								onClick={() => onSelect(selectedId === dep.id ? null : dep.id)}
							>
								<TableCell>
									<div className="flex items-center gap-2">
										<StatusBadge status={dep.status} />
										{dep.status === "running" && (
											<span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-tight border border-emerald-500/20 animate-pulse select-none">
												Active
											</span>
										)}
									</div>
								</TableCell>
								<TableCell className="font-mono text-xs text-muted-foreground">
									{depDisplayName(projectName, dep.id)}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">{dep.sourceType}</TableCell>
								<TableCell>
									{dep.branch ? (
										<Badge variant="outline" className="text-xs">
											{dep.branch}
										</Badge>
									) : (
										<span className="text-muted-foreground">—</span>
									)}
								</TableCell>
								<TableCell>
									<DeploymentDuration deployment={dep} />
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">{formatTimeAgo(dep.createdAt)}</TableCell>
								<TableCell className="text-right">
									<div className="flex items-center justify-end gap-1">
										{dep.status === "running" && dep.imageTag && dep.sourceType !== "image" && (
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-muted-foreground"
												onClick={(e) => {
													e.stopPropagation();
													onRedeploy(dep.id);
												}}
												title="Redeploy (rebuild from source)"
											>
												<RefreshCw className="h-3.5 w-3.5" />
											</Button>
										)}
										{(dep.status === "pending" || dep.status === "building") && (
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-red-500 hover:text-red-400"
												onClick={(e) => {
													e.stopPropagation();
													setCancelConfirmId(dep.id);
												}}
												title="Cancel deployment"
											>
												<svg
													className="h-3.5 w-3.5"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
												>
													<circle cx="12" cy="12" r="10" />
													<line x1="8" y1="12" x2="16" y2="12" />
												</svg>
											</Button>
										)}
										{dep.imageTag &&
											dep.status !== "running" &&
											dep.status !== "pending" &&
											dep.status !== "building" &&
											dep.status !== "deploying" && (
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-muted-foreground"
													onClick={(e) => {
														e.stopPropagation();
														onRollback(dep.id);
													}}
													title="Rollback to this version"
												>
													<History className="h-3.5 w-3.5" />
												</Button>
											)}
										{dep.status !== "running" && (
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-muted-foreground hover:text-red-500"
												onClick={(e) => {
													e.stopPropagation();
													setDeleteConfirmId(dep.id);
												}}
												title="Delete deployment"
											>
												<svg
													className="h-3.5 w-3.5"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
												>
													<polyline points="3 6 5 6 21 6" />
													<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
												</svg>
											</Button>
										)}
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{totalPages > 1 && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-border">
						<span className="text-xs text-muted-foreground">{totalDeployments} total deployments</span>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page === 0}
								onClick={() => onPageChange(page - 1)}
								className="h-8 w-8 p-0"
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="text-xs text-muted-foreground px-2">
								{page + 1} / {totalPages}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= totalPages - 1}
								onClick={() => onPageChange(page + 1)}
								className="h-8 w-8 p-0"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</div>

			{selectedDeployment && <DeploymentLogs deployment={selectedDeployment} />}

			<Dialog
				open={cancelConfirmId !== null}
				onOpenChange={(open) => {
					if (!open) setCancelConfirmId(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cancel deployment?</DialogTitle>
						<DialogDescription>
							This will stop the current build/deploy process. The deployment will be marked as failed. This cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCancelConfirmId(null)}>
							Keep running
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								if (cancelConfirmId) onCancel(cancelConfirmId);
								setCancelConfirmId(null);
							}}
						>
							Cancel deployment
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={deleteConfirmId !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteConfirmId(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete deployment?</DialogTitle>
						<DialogDescription>
							This will remove the deployment record, its build logs, and stop its container. The Docker image is kept
							for potential rollback. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								if (deleteConfirmId) onDelete(deleteConfirmId);
								setDeleteConfirmId(null);
							}}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
