import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Rocket, Server } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../api/client";
import { getGithubIntegration } from "../api/client";
import { BuildStrategySection, type ComposeServiceRow } from "../components/project/create/BuildStrategySection";
import { CreationStatusOverlay } from "../components/project/create/CreationStatusOverlay";
import { DeploymentTargetSection, getDeploymentTargets } from "../components/project/create/DeploymentTargetSection";
import { EnvVarsSection, type StagedEnv } from "../components/project/create/EnvVarsSection";
import { ProjectNameSection } from "../components/project/create/ProjectNameSection";
import { SourceSelectionSection } from "../components/project/create/SourceSelectionSection";
import { Button } from "../components/ui/button";
import { useCreateProject } from "../hooks/useProjects";
import type { CreateProjectInput, Server as DequelServer, GithubRepo } from "../types";
import type { FrameworkPreset } from "../utils/presets";
import { slugifyProjectName } from "../utils/slugify";

export function CreateProjectPage() {
	const navigate = useNavigate();
	const createProject = useCreateProject();

	// Deployment servers
	const { data: servers = [] } = useQuery({
		queryKey: ["servers"],
		queryFn: () => api.listServers().catch(() => [] as DequelServer[]),
		staleTime: 30_000,
	});

	// Source State
	const [sourceType, setSourceType] = useState<"git" | "upload">("git");
	const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
	const [repoUrl, setRepoUrl] = useState("");
	const [repoBranch, setRepoBranch] = useState("");
	const [zipFile, setZipFile] = useState<File | null>(null);
	const [githubConnected, setGithubConnected] = useState(false);
	const [githubConfigured, setGithubConfigured] = useState(false);
	const [showManualGit, setShowManualGit] = useState(false);

	// Form State
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [serverId, setServerId] = useState("local");

	// Build & Runtime Strategy State
	const [buildType, setBuildType] = useState<"railpack" | "compose">("railpack");
	const [projectType, setProjectType] = useState("web");
	const [selectedPresetId, setSelectedPresetId] = useState("");
	const [port, setPort] = useState("");
	const [sourceDir, setSourceDir] = useState("");
	const [buildCommand, setBuildCommand] = useState("");
	const [installCommand, setInstallCommand] = useState("");
	const [outputDir, setOutputDir] = useState("");
	const [startCommand, setStartCommand] = useState("");

	// Docker Compose Gateway Mapping
	const [composeServicesList, setComposeServicesList] = useState<ComposeServiceRow[]>([
		{ id: "1", serviceName: "", port: "", subdomain: "" },
	]);

	const addComposeServiceRow = () => {
		setComposeServicesList((prev) => [...prev, { id: String(Date.now()), serviceName: "", port: "", subdomain: "" }]);
	};

	const removeComposeServiceRow = (id: string) => {
		if (composeServicesList.length <= 1) return;
		setComposeServicesList((prev) => prev.filter((item) => item.id !== id));
	};

	const updateComposeServiceRow = (id: string, field: "serviceName" | "port" | "subdomain", value: string) => {
		setComposeServicesList((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
	};

	// Environment Variables State
	const [stagedEnvs, setStagedEnvs] = useState<StagedEnv[]>([]);

	// Status State
	const [submittingStatus, setSubmittingStatus] = useState<
		"idle" | "creating_project" | "creating_envs" | "done" | "error"
	>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		getGithubIntegration()
			.then((status) => {
				if ((status as any).configured) {
					setGithubConfigured(true);
					api
						.getGithubUser()
						.then(() => {
							setGithubConnected(true);
							setShowManualGit(false);
						})
						.catch(() => setShowManualGit(true));
				} else {
					setGithubConfigured(false);
					setShowManualGit(true);
				}
			})
			.catch(() => setShowManualGit(true));
	}, []);

	const handleSelectPreset = (preset: FrameworkPreset) => {
		setSelectedPresetId(preset.id);
		setProjectType(preset.projectType);
		setBuildCommand(preset.buildCommand || "");
		setInstallCommand(preset.installCommand || "");
		setStartCommand(preset.startCommand || "");
		setOutputDir(preset.outputDir || "");
		if (preset.defaultPort) setPort(preset.defaultPort);
	};

	const handleSelectRepo = (repo: GithubRepo | null) => {
		setSelectedRepo(repo);
		if (repo) {
			setRepoUrl(repo.cloneUrl);
			setRepoBranch(repo.defaultBranch);
			if (!name) {
				setName(slugifyProjectName(repo.name));
			}
		}
	};

	const handleRetry = () => {
		setSubmittingStatus("idle");
		setErrorMessage("");
	};

	const handleSubmit = async () => {
		if (!name.trim()) {
			setErrorMessage("Please enter a project name.");
			return;
		}

		if (sourceType === "git" && !repoUrl.trim()) {
			setErrorMessage("Please select a repository or enter a Git clone URL.");
			return;
		}

		if (sourceType === "upload" && !zipFile) {
			setErrorMessage("Please select a source ZIP archive.");
			return;
		}

		setSubmittingStatus("creating_project");
		setErrorMessage("");

		try {
			let finalRepoUrl = repoUrl;

			if (sourceType === "upload" && zipFile) {
				const uploadRes = await api.uploadSourceZip(zipFile);
				finalRepoUrl = uploadRes.filePath;
			}

			let composeServicesPayload: string | undefined;
			if (buildType === "compose" && composeServicesList.length > 0) {
				const validServices = composeServicesList.filter((s) => s.serviceName.trim());
				if (validServices.length > 0) {
					composeServicesPayload = JSON.stringify(validServices);
				}
			}

			const projectPayload: CreateProjectInput = {
				name: name.trim(),
				description: description.trim() || undefined,
				serverId: getDeploymentTargets(servers).some((s) => s.id === serverId) ? serverId : "local",
				sourceType,
				repoUrl: finalRepoUrl,
				repoBranch: repoBranch.trim() || undefined,
				buildType,
				projectType,
				sourceDir: sourceDir.trim() || undefined,
				buildCommand: buildType === "railpack" ? buildCommand.trim() || undefined : undefined,
				installCommand: buildType === "railpack" ? installCommand.trim() || undefined : undefined,
				outputDir: buildType === "railpack" ? outputDir.trim() || undefined : undefined,
				startCommand: buildType === "railpack" ? startCommand.trim() || undefined : undefined,
				port: port ? Number(port) : undefined,
				composeServices: composeServicesPayload,
			};

			const project = await createProject.mutateAsync(projectPayload);

			if (stagedEnvs.length > 0) {
				setSubmittingStatus("creating_envs");
				let failedEnvKey = "";
				try {
					for (const env of stagedEnvs) {
						failedEnvKey = env.key;
						await api.setEnvVar(project.id, env.key, env.value, env.environment);
					}
				} catch (envErr: any) {
					try {
						await api.deleteProject(project.id);
					} catch {}
					setSubmittingStatus("error");
					setErrorMessage(
						`Failed to set environment variable "${failedEnvKey}": ${envErr.message || "Unknown error"}. Created project was cleaned up.`,
					);
					return;
				}
			}

			setSubmittingStatus("done");
			setTimeout(() => {
				navigate({ to: "/project/$projectId", params: { projectId: project.id }, search: { tab: "deployments" } });
			}, 1000);
		} catch (err: any) {
			setSubmittingStatus("error");
			setErrorMessage(err.message || "Failed to create project.");
		}
	};

	return (
		<div className="min-h-screen bg-[#070709] text-zinc-100 p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
			{/* Top Bar Header */}
			<div className="flex items-center justify-between border-b border-[#181820] pb-6">
				<div>
					<Link
						to="/"
						className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors mb-3"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to Dashboard
					</Link>
					<h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">New Project</h1>
					<p className="text-xs sm:text-sm text-zinc-400 mt-1">
						Deploy an application from Git or ZIP upload with automated routing, SSL, and scaling.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
				{/* Left Column: Form Configuration */}
				<div className="lg:col-span-8 space-y-6">
					{/* Source Selection (Git Provider vs ZIP Upload) */}
					<SourceSelectionSection
						sourceType={sourceType}
						setSourceType={setSourceType}
						selectedRepo={selectedRepo}
						onSelectRepo={handleSelectRepo}
						repoUrl={repoUrl}
						setRepoUrl={setRepoUrl}
						repoBranch={repoBranch}
						setRepoBranch={setRepoBranch}
						showManualGit={showManualGit}
						setShowManualGit={setShowManualGit}
						githubConnected={githubConnected}
						githubConfigured={githubConfigured}
						zipFile={zipFile}
						setZipFile={setZipFile}
						onConnectGithub={async () => {
							const res = await api.getGithubAuthUrl();
							window.location.href = res.url;
						}}
						onDisconnectGithub={() => {
							setGithubConnected(false);
							setSelectedRepo(null);
						}}
					/>

					{/* Project Details */}
					<ProjectNameSection name={name} setName={setName} description={description} setDescription={setDescription} />

					{/* Deployment Target */}
					<DeploymentTargetSection serverId={serverId} setServerId={setServerId} servers={servers} />

					{/* Build Strategy & Application Preset (with SVG logos) */}
					<BuildStrategySection
						buildType={buildType}
						setBuildType={setBuildType}
						projectType={projectType}
						setProjectType={setProjectType}
						selectedPresetId={selectedPresetId}
						onSelectPreset={handleSelectPreset}
						buildCommand={buildCommand}
						setBuildCommand={setBuildCommand}
						installCommand={installCommand}
						setInstallCommand={setInstallCommand}
						startCommand={startCommand}
						setStartCommand={setStartCommand}
						outputDir={outputDir}
						setOutputDir={setOutputDir}
						port={port}
						setPort={setPort}
						sourceDir={sourceDir}
						setSourceDir={setSourceDir}
						composeServicesList={composeServicesList}
						addComposeServiceRow={addComposeServiceRow}
						removeComposeServiceRow={removeComposeServiceRow}
						updateComposeServiceRow={updateComposeServiceRow}
					/>

					{/* Environment Variables (with File Upload, Key-Value builder, and Bulk paste) */}
					<EnvVarsSection stagedEnvs={stagedEnvs} setStagedEnvs={setStagedEnvs} />

					{/* Error Message Display */}
					{errorMessage && (
						<div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span>{errorMessage}</span>
						</div>
					)}
				</div>

				{/* Right Column: Live Summary Sidebar */}
				<div className="lg:col-span-4 space-y-4">
					<div className="bg-[#0c0c0e] border border-[#1c1c21] p-5 rounded-2xl space-y-4 sticky top-6 shadow-xl">
						<h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
							<Server className="h-4 w-4 text-orange-500" />
							Deployment Summary
						</h3>

						<div className="space-y-3 text-xs">
							<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
								<div className="text-[10px] text-zinc-400 font-bold uppercase">Project Name</div>
								<div className="font-bold text-zinc-100 font-mono">{name || "—"}</div>
							</div>

							<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
								<div className="text-[10px] text-zinc-400 font-bold uppercase">Code Provider</div>
								<div className="font-bold text-emerald-400 uppercase">{sourceType}</div>
							</div>

							<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
								<div className="text-[10px] text-zinc-400 font-bold uppercase">Build Strategy</div>
								<div className="font-bold text-amber-400 uppercase">{buildType}</div>
							</div>

							{buildType === "compose" ? (
								<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
									<div className="text-[10px] text-zinc-400 font-bold uppercase">Compose Ingress</div>
									<div className="text-zinc-300 font-mono text-[11px]">
										{composeServicesList[0]?.serviceName.trim() || "Auto-detect"}{" "}
										{composeServicesList[0]?.port.trim() ? `:${composeServicesList[0].port.trim()}` : ""}
									</div>
								</div>
							) : (
								<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
									<div className="text-[10px] text-zinc-400 font-bold uppercase">Type & Port</div>
									<div className="text-zinc-300 font-mono text-[11px]">
										{projectType === "web" ? "Web Service" : "Static Site"} ({port || "3000"})
									</div>
								</div>
							)}

							<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
								<div className="text-[10px] text-zinc-400 font-bold uppercase">Environment Vars</div>
								<div className="text-zinc-300 font-mono text-[11px]">{stagedEnvs.length} variables</div>
							</div>
						</div>

						<Button
							type="button"
							onClick={handleSubmit}
							disabled={!name.trim() || (submittingStatus !== "idle" && submittingStatus !== "error")}
							className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold h-11 text-xs rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 mt-4"
						>
							<Rocket className="h-4 w-4" />
							{submittingStatus === "error"
								? "Retry Deployment"
								: submittingStatus === "idle"
									? "Launch Deployment"
									: "Deploying..."}
						</Button>
					</div>
				</div>
			</div>

			<CreationStatusOverlay
				submittingStatus={submittingStatus}
				errorMessage={errorMessage}
				hasEnvs={stagedEnvs.length > 0}
				onRetry={handleRetry}
			/>
		</div>
	);
}
