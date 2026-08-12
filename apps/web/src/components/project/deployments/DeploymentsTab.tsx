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
import { getRepoHooks, registerRepoHook, removeRepoHook } from "../../../api/client";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Rocket, Play, Webhook } from "lucide-react";
import { ManualDeployDialog } from "./manual-deploy-dialog";
import { DeploymentHistory } from "./deployment-history";
import { ClearCacheToggle } from "./clear-cache-toggle";

const PAGE_SIZE = 5;

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
	const [clearCache, setClearCache] =
		useState(false);
	const [isAutoDeploying, setIsAutoDeploying] =
		useState(false);
	const autoDeployedRef =
		useRef(false);

	const [webhookActive, setWebhookActive] = useState(false);
	const [webhookLoading, setWebhookLoading] = useState(false);
	const [webhookChecked, setWebhookChecked] = useState(false);
	const [webhookError, setWebhookError] = useState<string | null>(null);

	useEffect(() => {
		if (!project?.repoUrl) return;
		const parseRepo = (url: string): { owner: string; repo: string } | null => {
			const match = url.replace(/\.git$/, "").match(/github\.com\/([^/]+)\/([^/]+)/);
			return match ? { owner: match[1], repo: match[2] } : null;
		};
		const repo = parseRepo(project.repoUrl);
		if (!repo) return;
		setWebhookChecked(false);
		let cancelled = false;
		getRepoHooks(repo.owner, repo.repo)
			.then((hooks) => {
				if (!cancelled) {
					const expectedUrl = `${window.location.origin}/api/github/webhook`;
					setWebhookActive(hooks.some((h) => h.url === expectedUrl));
				}
			})
			.catch(() => {
				if (!cancelled) setWebhookActive(false);
			})
			.finally(() => {
				if (!cancelled) setWebhookChecked(true);
			});
		return () => { cancelled = true; };
	}, [project?.repoUrl]);

	const toggleWebhook = async () => {
		if (!project?.repoUrl) return;
		const match = project.repoUrl.replace(/\.git$/, "").match(/github\.com\/([^/]+)\/([^/]+)/);
		if (!match) return;
		const [, owner, repo] = match;
		setWebhookLoading(true);
		setWebhookError(null);
		try {
			if (webhookActive) {
				await removeRepoHook(owner, repo);
				setWebhookActive(false);
			} else {
				await registerRepoHook(owner, repo);
				setWebhookActive(true);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to update webhook";
			setWebhookError(message.includes("Not authenticated") ? "GitHub session expired. Reconnect GitHub in Settings, then try again." : message);
		} finally {
			setWebhookLoading(false);
		}
	};

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
		if (clearCache)
			form.set("clearCache", "true");
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
		setClearCache(false);
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

	const [showManualDeployDialog, setShowManualDeployDialog] = useState(false);

	const handleManualDeploy = async (form: FormData) => {
		form.set("sourceType", "git");
		if (projectId) form.set("projectId", projectId);
		await createDeployment.mutateAsync(form);
	};

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

					{sourceType === "git" ? (
						<div className="space-y-4">
							<div className="p-4 rounded-lg bg-[#141417]/50 border border-[#222227] space-y-3">
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Repository URL</div>
										<div className="text-sm font-mono text-zinc-200">{project?.repoUrl || "No repository configured"}</div>
									</div>
									<div className="text-right space-y-1">
										<div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Branch</div>
										<div className="text-xs bg-[#1a1a20] border border-[#33333b] text-zinc-300 px-2 py-1 rounded font-mono inline-block">
											{project?.repoBranch || "main"}
										</div>
									</div>
								</div>
								{webhookError && (
									<p className="text-xs text-red-400">{webhookError}</p>
								)}
							<div className="pt-2 flex justify-end gap-2">
								{webhookChecked && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={toggleWebhook}
										disabled={webhookLoading}
										className={webhookActive
											? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
											: "border-zinc-700 text-zinc-400 hover:border-zinc-600"
										}
									>
										<Webhook className="h-3.5 w-3.5 mr-1.5" />
										{webhookLoading
											? "Loading..."
											: webhookActive
												? "Auto-deploy on"
												: "Enable auto-deploy"}
									</Button>
								)}
								<Button
									type="button"
									onClick={() => setShowManualDeployDialog(true)}
									className="bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-2 shadow-lg shadow-amber-500/10"
								>
									<Play className="h-4 w-4 fill-current" /> Manual Deploy...
								</Button>
							</div>
							</div>
						</div>
					) : (
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
							<Input
								type="file"
								accept=".zip,.tar,.tar.gz,.tgz"
								className="file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground"
							/>
							<ClearCacheToggle
								checked={clearCache}
								onChange={setClearCache}
								id="clearCacheUpload"
							/>
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
					)}
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
				<DeploymentHistory
					deployments={deployments}
					page={page}
					totalPages={totalPages}
					totalDeployments={totalDeployments}
					projectName={project?.name}
					onPageChange={setPage}
					onSelect={setSelectedId}
					selectedId={selectedId}
					onRedeploy={(id) => redeploy.mutate(id)}
					onRollback={(id) => rollback.mutate(id)}
					onCancel={(id) => cancel.mutate(id)}
					onDelete={(id) => deleteDep.mutate(id)}
				/>
			)}

			<ManualDeployDialog
				open={showManualDeployDialog}
				onOpenChange={setShowManualDeployDialog}
				projectId={projectId}
				projectName={project?.name ?? ""}
				repoUrl={project?.repoUrl}
				repoBranch={project?.repoBranch}
				isPending={createDeployment.isPending}
				onDeploy={handleManualDeploy}
			/>
		</div>
	);
}


