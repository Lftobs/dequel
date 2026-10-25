import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Clock,
	ExternalLink,
	GitBranch,
	GitCommit,
	History,
	RefreshCw,
	Server,
	Terminal,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import * as api from "../api/client";
import {
	DeploymentDuration,
	DeploymentLogs,
	depDisplayName,
	formatTimeAgo,
} from "../components/project/deployments/deployment-logs";
import { StatusBadge } from "../components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../components/ui/dialog";
import {
	useCancelDeployment,
	useDeleteDeployment,
	useRedeployDeployment,
	useRollbackDeployment,
} from "../hooks/useDeployments";
import { useProject } from "../hooks/useProjects";

interface DeploymentDetailPageProps {
	projectId: string;
	deploymentId: string;
}

export function DeploymentDetailPage({ projectId, deploymentId }: DeploymentDetailPageProps) {
	const navigate = useNavigate();
	const { data: project } = useProject(projectId);

	const { data: deployment, isLoading } = useQuery({
		queryKey: ["deployment", deploymentId],
		queryFn: () => api.getDeployment(deploymentId),
		refetchInterval: (query) => {
			const s = query.state.data?.status;
			return s === "pending" || s === "building" || s === "deploying" ? 2500 : false;
		},
	});

	const redeploy = useRedeployDeployment();
	const rollback = useRollbackDeployment();
	const cancel = useCancelDeployment();
	const deleteDep = useDeleteDeployment();

	const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	const handleBack = () => {
		navigate({
			to: "/project/$projectId",
			params: { projectId },
			search: { tab: "deployments" } as any,
		});
	};

	if (isLoading) {
		return (
			<div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 select-none">
				<div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
				<div className="text-zinc-500 text-xs tracking-wider uppercase font-mono">Loading Deployment Details...</div>
			</div>
		);
	}

	if (!deployment || deployment.projectId !== projectId) {
		return (
			<div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
				<div className="w-14 h-14 rounded-2xl bg-secondary/30 border border-border flex items-center justify-center text-muted-foreground">
					<Terminal className="h-6 w-6" />
				</div>
				<h2 className="text-xl font-bold text-foreground">Deployment Not Found</h2>
				<p className="text-xs text-muted-foreground max-w-sm">
					The deployment record could not be loaded or may have been deleted.
				</p>
				<Button variant="outline" size="sm" onClick={handleBack} className="text-xs">
					<ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Deployments
				</Button>
			</div>
		);
	}

	const isRunning = deployment.status === "running";
	const isBuilding = deployment.status === "building" || deployment.status === "deploying";
	const isPending = deployment.status === "pending";
	const isFailed = deployment.status === "failed";
	const canCancel = isPending || deployment.status === "building";
	const canRollback =
		Boolean(deployment.imageTag) &&
		!isRunning &&
		!isPending &&
		!isBuilding &&
		deployment.sourceType !== "image" &&
		project?.buildType !== "compose";
	const canRedeploy = !isPending && !isBuilding && deployment.sourceType !== "image";
	const canDelete = !isRunning && !isPending && !isBuilding;

	const displayName = depDisplayName(project?.name, deployment.id);

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="flex items-start sm:items-center gap-3 min-w-0">
					<Button
						variant="ghost"
						size="icon"
						onClick={handleBack}
						className="h-8 w-8 text-muted-foreground shrink-0 mt-0.5 sm:mt-0"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-lg sm:text-xl font-bold text-foreground font-mono truncate">{displayName}</h1>
							<StatusBadge status={deployment.status} />
							{isRunning && (
								<Badge
									variant="outline"
									className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/20 animate-pulse"
								>
									Active
								</Badge>
							)}
						</div>
						<div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
							<span>Project:</span>
							<button type="button" onClick={handleBack} className="text-foreground hover:underline font-medium">
								{project?.name || projectId}
							</button>
							<span>•</span>
							<span>Triggered {formatTimeAgo(deployment.createdAt)}</span>
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 shrink-0">
					{deployment.liveUrl && (
						<a
							href={deployment.liveUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-all"
						>
							View Site <ExternalLink className="h-3.5 w-3.5" />
						</a>
					)}
					{canCancel && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCancelConfirmOpen(true)}
							disabled={cancel.isPending}
							className="text-xs h-8 text-red-500 hover:text-red-400 border-red-500/20 hover:bg-red-500/10"
						>
							<XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancel
						</Button>
					)}
					{canRollback && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => rollback.mutate(deployment.id)}
							disabled={rollback.isPending}
							className="text-xs h-8 gap-1.5"
						>
							<History className="h-3.5 w-3.5" /> Rollback
						</Button>
					)}
					{canRedeploy && (
						<Button
							size="sm"
							onClick={() => redeploy.mutate(deployment.id)}
							disabled={redeploy.isPending}
							className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground font-semibold"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${redeploy.isPending ? "animate-spin" : ""}`} />
							{redeploy.isPending ? "Redeploying..." : "Redeploy"}
						</Button>
					)}
					{canDelete && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setDeleteConfirmOpen(true)}
							disabled={deleteDep.isPending}
							className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
							title="Delete deployment"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>

			{isFailed && deployment.failureReason && (
				<Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
					<AlertCircle className="h-4 w-4 text-red-400" />
					<AlertTitle className="text-xs font-semibold text-red-300">Deployment Failed</AlertTitle>
					<AlertDescription className="text-xs font-mono text-red-200 mt-1 break-words">
						{deployment.failureReason}
					</AlertDescription>
				</Alert>
			)}

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				<Card className="border-border bg-card">
					<CardHeader className="p-3.5 pb-1">
						<CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
							<GitBranch className="h-3.5 w-3.5" /> Source & Branch
						</CardTitle>
					</CardHeader>
					<CardContent className="p-3.5 pt-1 space-y-1">
						<div className="text-sm font-semibold text-foreground capitalize">{deployment.sourceType}</div>
						{deployment.branch ? (
							<div className="text-xs font-mono text-muted-foreground truncate">branch: {deployment.branch}</div>
						) : (
							<div className="text-xs font-mono text-muted-foreground truncate">
								{deployment.sourceRef.split("/").pop()}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="border-border bg-card">
					<CardHeader className="p-3.5 pb-1">
						<CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
							<GitCommit className="h-3.5 w-3.5" /> Commit SHA
						</CardTitle>
					</CardHeader>
					<CardContent className="p-3.5 pt-1 space-y-1">
						<div className="text-sm font-mono font-semibold text-foreground">
							{deployment.commitSha ? deployment.commitSha.slice(0, 8) : "N/A"}
						</div>
						<div className="text-xs text-muted-foreground">
							{deployment.environment ? `Env: ${deployment.environment}` : "production"}
						</div>
					</CardContent>
				</Card>

				<Card className="border-border bg-card">
					<CardHeader className="p-3.5 pb-1">
						<CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
							<Clock className="h-3.5 w-3.5" /> Duration
						</CardTitle>
					</CardHeader>
					<CardContent className="p-3.5 pt-1 space-y-1">
						<div className="text-sm font-semibold text-foreground font-mono">
							<DeploymentDuration deployment={deployment} />
						</div>
						<div className="text-xs text-muted-foreground">
							{deployment.finishedAt ? `Finished ${formatTimeAgo(deployment.finishedAt)}` : "In Progress"}
						</div>
					</CardContent>
				</Card>

				<Card className="border-border bg-card">
					<CardHeader className="p-3.5 pb-1">
						<CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
							<Server className="h-3.5 w-3.5" /> Server & Target
						</CardTitle>
					</CardHeader>
					<CardContent className="p-3.5 pt-1 space-y-1">
						<div className="text-sm font-mono font-semibold text-foreground truncate">
							{deployment.serverId || "local"}
						</div>
						<div className="text-xs font-mono text-muted-foreground truncate">
							{deployment.containerName || "Not assigned"}
						</div>
					</CardContent>
				</Card>
			</div>

			<DeploymentLogs deployment={deployment} />

			<Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cancel deployment?</DialogTitle>
						<DialogDescription>
							This will terminate the build and deployment process. The deployment will be marked as failed.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2">
						<Button variant="ghost" size="sm" onClick={() => setCancelConfirmOpen(false)}>
							Keep Running
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => {
								cancel.mutate(deployment.id);
								setCancelConfirmOpen(false);
							}}
						>
							Yes, Cancel Deployment
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete deployment?</DialogTitle>
						<DialogDescription>
							This will remove this deployment record and its execution logs. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2">
						<Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => {
								deleteDep.mutate(deployment.id, { onSuccess: () => handleBack() });
								setDeleteConfirmOpen(false);
							}}
						>
							Delete Deployment
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
