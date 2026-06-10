import React, { useState, useEffect, useRef } from "react";
import { useProject } from "../../../hooks/useProjects";
import {
	useDeployments,
	useCreateDeployment,
	useRollbackDeployment,
	useRedeployDeployment,
	useCancelDeployment,
	useDeleteDeployment,
} from "../../../hooks/useDeployments";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../../ui/dialog";
import { useDeploymentLogs } from "../../../hooks/useDeploymentLogs";
import { StatusBadge } from "../../StatusBadge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Rocket, Play, RefreshCw, RotateCcw, Terminal, ChevronLeft, ChevronRight, History } from "lucide-react";
import { cn } from "../../../lib/utils";

function formatTimeAgo(dateStr: string) {
	const diff =
		Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

const PAGE_SIZE = 5;

function depDisplayName(projectName: string | undefined, depId: string) {
	const short = depId.slice(0, 8);
	if (!projectName) return short;
	const slug = projectName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
	return `${slug}-${short}`;
}

interface DeploymentsTabProps {
	projectId: string;
}

export function DeploymentsTab({ projectId }: DeploymentsTabProps) {
	const { data: project } =
		useProject(projectId);
	const [page, setPage] = useState(0);
	const { data, isLoading } =
		useDeployments(projectId, page, PAGE_SIZE);
	const deployments = data?.items ?? [];
	const totalDeployments = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalDeployments / PAGE_SIZE));
	const createDeployment =
		useCreateDeployment();
	const rollback = useRollbackDeployment();
	const redeploy = useRedeployDeployment();
	const cancel = useCancelDeployment();
	const deleteDep = useDeleteDeployment();
	const [deleteConfirmId, setDeleteConfirmId] = useState<
		string | null
	>(null);
	const [selectedId, setSelectedId] = useState<
		string | null
	>(null);
	const [sourceType, setSourceType] = useState<
		"git" | "upload" | "compose"
	>("git");
	const [gitUrl, setGitUrl] = useState("");
	const [branch, setBranch] = useState("");
	const [environment, setEnvironment] =
		useState("");
	const [showGitSwitch, setShowGitSwitch] =
		useState(false);
	const [switchGitUrl, setSwitchGitUrl] =
		useState("");
	const [switchBranch, setSwitchBranch] =
		useState("");
	const [isAutoDeploying, setIsAutoDeploying] =
		useState(false);
	const autoDeployedRef =
		useRef(false);

	useEffect(() => {
		if (!project) return;
		setGitUrl(project.repoUrl ?? "");
		setBranch(project.repoBranch ?? "");
		setSourceType(
			project.repoUrl ? "git" : "upload",
		);
		setSwitchGitUrl(
			project.repoUrl ?? "",
		);
		setSwitchBranch(
			project.repoBranch ?? "",
		);
	}, [
		project?.repoUrl,
		project?.repoBranch,
		project,
	]);

	useEffect(() => {
		if (
			autoDeployedRef.current ||
			isLoading ||
			totalDeployments > 0 ||
			!project?.repoUrl
		)
			return;
		autoDeployedRef.current = true;
		const form = new FormData();
		form.set("sourceType", "git");
		form.set("projectId", projectId);
		form.set("gitUrl", project.repoUrl);
		if (project.repoBranch)
			form.set(
				"branch",
				project.repoBranch,
			);
		setIsAutoDeploying(true);
		createDeployment
			.mutateAsync(form)
			.finally(() =>
				setIsAutoDeploying(false),
			);
	}, [
		totalDeployments,
		project?.repoUrl,
		project?.repoBranch,
		projectId,
		createDeployment,
	]);

	const canEditSource =
		totalDeployments === 0;
	const canUpdateDeployment =
		sourceType === "upload" ||
		sourceType === "compose";

	const handleDeploy = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		if (
			!canUpdateDeployment ||
			isAutoDeploying
		)
			return;
		const form = new FormData();
		form.set("sourceType", sourceType);
		if (projectId)
			form.set("projectId", projectId);
		if (environment)
			form.set("environment", environment);
		if (branch) form.set("branch", branch);
		if ((sourceType as string) === "git") {
			if (!gitUrl.trim()) return;
			form.set("gitUrl", gitUrl.trim());
		} else {
			const fileInput = (
				e.target as HTMLFormElement
			).querySelector(
				'input[type="file"]',
			) as HTMLInputElement;
			if (!fileInput?.files?.[0]) return;
			form.set(
				"archive",
				fileInput.files[0],
			);
		}
		await createDeployment.mutateAsync(form);
		setGitUrl("");
		setBranch("");
		setEnvironment("");
		setSourceType("git");
	};

	const handleSwitchToGit = async () => {
		if (!switchGitUrl.trim()) return;
		const form = new FormData();
		form.set("sourceType", "git");
		form.set("projectId", projectId);
		form.set("gitUrl", switchGitUrl.trim());
		if (switchBranch.trim())
			form.set(
				"branch",
				switchBranch.trim(),
			);
		await createDeployment.mutateAsync(form);
		setGitUrl(switchGitUrl.trim());
		setBranch(switchBranch.trim());
		setSourceType("git");
		setShowGitSwitch(false);
	};

	const selectedDeployment = deployments.find(
		(d) => d.id === selectedId,
	);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<Rocket className="h-4 w-4" />
						Deployment
					</CardTitle>
				</CardHeader>
				<CardContent>
					{totalDeployments > 0 && sourceType !== "git" && (
						<div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground mb-3">
							<span>
								New deployments
								are created when
								you upload or use
								compose. Git
								redeploys on
								branch updates.
							</span>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() =>
									setShowGitSwitch(
										true,
									)
								}
								disabled={
									isAutoDeploying
								}
							>
								Switch to Git
							</Button>
						</div>
					)}

					<form
						onSubmit={handleDeploy}
						className="space-y-3"
					>
						<div className="flex gap-2">
							{(
								[
									"git",
									"upload",
									"compose",
								] as const
							).map((type) => (
								<Button
									key={type}
									type="button"
									variant={
										sourceType ===
										type
											? "default"
											: "outline"
									}
									size="sm"
									onClick={() =>
										setSourceType(
											type,
										)
									}
									disabled={
										!canEditSource &&
										type !==
											sourceType
									}
								>
									{type ===
									"git"
										? "Git"
										: type ===
											  "upload"
											? "Upload"
											: "Compose"}
								</Button>
							))}
						</div>
						{sourceType === "git" ? (
							<div className="flex gap-2">
								<Input
									placeholder="https://github.com/user/repo.git"
									value={gitUrl}
									onChange={(
										e,
									) =>
										setGitUrl(
											e
												.target
												.value,
										)
									}
									className="flex-1"
									disabled
								/>
								<Input
									placeholder="Branch"
									value={branch}
									onChange={(
										e,
									) =>
										setBranch(
											e
												.target
												.value,
										)
									}
									className="w-32"
									disabled
								/>
							</div>
						) : (
							<Input
								type="file"
								accept=".zip,.tar,.tar.gz,.tgz"
								className="file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground"
							/>
						)}
						<div className="flex gap-2">
							<Input
								placeholder="Environment (e.g. production)"
								value={
									environment
								}
								onChange={(e) =>
									setEnvironment(
										e.target
											.value,
									)
								}
								className="flex-1"
							/>
							<Button
								type="submit"
								disabled={
									createDeployment.isPending ||
									!canUpdateDeployment ||
									isAutoDeploying
								}
							>
								{createDeployment.isPending ||
								isAutoDeploying ? (
									"Deploying..."
								) : (
									<>
										<Play className="mr-1.5 h-4 w-4" />
										Update
									</>
								)}
							</Button>
						</div>
						{!canEditSource && (
							<div className="text-xs text-muted-foreground">
								Source type locked
								after first
								deploy. Use Switch
								to Git to change
								source.
							</div>
						)}
					</form>
				</CardContent>
			</Card>

			{showGitSwitch && (
				<Card className="border-primary/30 bg-primary/5">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm text-foreground">
							Switch deployment
							source to Git?
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-xs text-foreground">
							Enter the git repository
							URL to create a new
							deployment from source.
						</p>
						<Input
							placeholder="https://github.com/user/repo.git"
							value={switchGitUrl}
							onChange={(e) =>
								setSwitchGitUrl(
									e.target.value,
								)
							}
							className="text-sm"
						/>
						<Input
							placeholder="Branch (optional)"
							value={switchBranch}
							onChange={(e) =>
								setSwitchBranch(
									e.target.value,
								)
							}
							className="text-sm"
						/>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() =>
									setShowGitSwitch(
										false,
									)
								}
							>
								Cancel
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={
									handleSwitchToGit
								}
								disabled={
									!switchGitUrl.trim() ||
									createDeployment.isPending ||
									isAutoDeploying
								}
							>
								{createDeployment.isPending
									? "Switching..."
									: "Switch"}
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{totalDeployments > 0 && (
				<div className="rounded-xl border border-border bg-card overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									Status
								</TableHead>
								<TableHead>
									Deployment
								</TableHead>
								<TableHead>
									Source
								</TableHead>
								<TableHead>
									Branch
								</TableHead>
								<TableHead>
									Age
								</TableHead>
								<TableHead className="w-24"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{deployments.map(
								(dep) => (
									<TableRow
										key={
											dep.id
										}
										className={cn(
											"cursor-pointer transition-all",
											selectedId === dep.id && "bg-primary/5"
										)}
										onClick={() =>
											setSelectedId(
												selectedId ===
													dep.id
													? null
													: dep.id,
											)
										}
									>
										<TableCell>
											<div className="flex items-center gap-2">
												<StatusBadge
													status={
														dep.status
													}
												/>
												{dep.status === "running" && (
													<span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-tight border border-emerald-500/20 animate-pulse select-none">
														Active
													</span>
												)}
											</div>
										</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground">
											{depDisplayName(
												project?.name,
												dep.id,
											)}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{
												dep.sourceType
											}
										</TableCell>
										<TableCell>
											{dep.branch ? (
												<Badge
													variant="outline"
													className="text-xs"
												>
													{
														dep.branch
													}
												</Badge>
											) : (
												<span className="text-muted-foreground">
													—
												</span>
											)}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{formatTimeAgo(
												dep.createdAt,
											)}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex items-center justify-end gap-1">
												{dep.status === "running" && dep.imageTag && dep.sourceType !== "image" && (
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground"
														onClick={(
															e,
														) => {
															e.stopPropagation();
															redeploy.mutate(
																dep.id,
															);
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
														onClick={(
															e,
														) => {
															e.stopPropagation();
															cancel.mutate(
																dep.id,
															);
														}}
														title="Cancel deployment"
													>
														<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
													</Button>
												)}
												{dep.imageTag && dep.status !== "running" && dep.status !== "pending" && dep.status !== "building" && dep.status !== "deploying" && (
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground"
														onClick={(
															e,
														) => {
															e.stopPropagation();
															rollback.mutate(
																dep.id,
															);
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
														onClick={(
															e,
														) => {
															e.stopPropagation();
															setDeleteConfirmId(
																dep.id,
															);
														}}
														title="Delete deployment"
													>
														<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								),
							)}
						</TableBody>
					</Table>
					{totalPages > 1 && (
						<div className="flex items-center justify-between px-4 py-3 border-t border-border">
							<span className="text-xs text-muted-foreground">
								{totalDeployments} total deployments
							</span>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={page === 0}
									onClick={() => setPage(p => p - 1)}
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
									onClick={() => setPage(p => p + 1)}
									className="h-8 w-8 p-0"
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</div>
			)}

			{selectedDeployment && (
				<DeploymentLogs
					deployment={
						selectedDeployment
					}
				/>
			)}

			<Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete deployment?</DialogTitle>
						<DialogDescription>
							This will remove the deployment record, its build logs, and stop its container. The Docker image is kept for potential rollback. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								if (deleteConfirmId) deleteDep.mutate(deleteConfirmId);
								setDeleteConfirmId(null);
							}}
						>
							Delete
					</Button>
				</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function fmtLogTs(raw: string | undefined) {
	if (!raw) return "";
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) return raw;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function DeploymentLogs({
	deployment,
}: {
	deployment: any;
}) {
	const { logs, isLoading } = useDeploymentLogs(
		deployment.id,
	);
	const endRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		endRef.current?.scrollIntoView({
			behavior: "smooth",
		});
	}, [logs]);

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm flex items-center gap-2">
					<Terminal className="h-4 w-4" />
					Build Logs —{" "}
					{deployment.id.slice(0, 8)}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="text-center py-8 text-muted-foreground text-sm">
						Loading logs...
					</div>
				) : logs.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground text-sm">
						No build logs available
						for this deployment.
					</div>
				) : (
					<div className="log-box">
						{logs.map((log, i) => (
							<div
								key={i}
								className={`log-line ${log.message.startsWith("CRITICAL") ? "dim" : ""}`}
							>
								<span className="log-stage">
									[{log.stage}]-[{fmtLogTs((log as any).timestamp || log.createdAt)}]
								</span>
								<span className="log-msg">
									{log.message}
								</span>
							</div>
						))}
						<div ref={endRef} />
					</div>
				)}
			</CardContent>
		</Card>
	);
}
