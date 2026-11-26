import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Container, FolderGit2, GitBranch, Link2, Upload } from "lucide-react";
import * as api from "../../../api/client";
import { cn } from "../../../lib/utils";
import type { GithubRepo, ImagePullPolicy } from "../../../types";
import { RepoPicker } from "../../github/RepoPicker";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { GitAuthFields, type GitProviderValue } from "./GitAuthFields";

type SourceType = "git" | "upload" | "image";

interface SourceSelectionSectionProps {
	sourceType: SourceType;
	setSourceType: (v: SourceType) => void;
	selectedRepo: GithubRepo | null;
	onSelectRepo: (repo: GithubRepo | null) => void;
	repoUrl: string;
	setRepoUrl: (v: string) => void;
	repoBranch: string;
	setRepoBranch: (v: string) => void;
	showManualGit: boolean;
	setShowManualGit: (v: boolean) => void;
	githubConnected: boolean;
	githubConfigured: boolean;
	zipFile: File | null;
	setZipFile: (f: File | null) => void;
	onConnectGithub: () => void;
	onDisconnectGithub: () => void;
	gitProvider: GitProviderValue;
	setGitProvider: (v: GitProviderValue) => void;
	gitToken: string;
	setGitToken: (v: string) => void;
	imageRef: string;
	setImageRef: (v: string) => void;
	imagePullPolicy: ImagePullPolicy;
	setImagePullPolicy: (v: ImagePullPolicy) => void;
	registryId: string;
	setRegistryId: (v: string) => void;
}

const sourceOptions: Array<{ value: SourceType; label: string; tag: string; icon: typeof GitBranch; desc: string }> = [
	{
		value: "git",
		label: "Git Repository",
		tag: "Git",
		icon: GitBranch,
		desc: "GitHub, GitLab, Bitbucket, Gitea, or any HTTPS clone URL.",
	},
	{
		value: "image",
		label: "Docker Image",
		tag: "Registry",
		icon: Container,
		desc: "Pull a prebuilt image from Docker Hub or a private registry.",
	},
	{
		value: "upload",
		label: "ZIP Upload",
		tag: "Archive",
		icon: Upload,
		desc: "Upload a source archive and build it on the server.",
	},
];

export function SourceSelectionSection({
	sourceType,
	setSourceType,
	selectedRepo,
	onSelectRepo,
	repoUrl,
	setRepoUrl,
	repoBranch,
	setRepoBranch,
	showManualGit,
	setShowManualGit,
	githubConnected,
	githubConfigured,
	zipFile,
	setZipFile,
	onConnectGithub,
	onDisconnectGithub,
	gitProvider,
	setGitProvider,
	gitToken,
	setGitToken,
	imageRef,
	setImageRef,
	imagePullPolicy,
	setImagePullPolicy,
	registryId,
	setRegistryId,
}: SourceSelectionSectionProps) {
	const { data: registries = [] } = useQuery({
		queryKey: ["registries"],
		queryFn: () => api.listRegistries().catch(() => []),
		enabled: sourceType === "image",
		staleTime: 60_000,
	});

	const handleSourceTypeChange = (type: SourceType) => {
		setSourceType(type);
		if (type === "upload") {
			onSelectRepo(null);
			setRepoUrl("");
			setRepoBranch("");
		} else if (type === "image") {
			onSelectRepo(null);
			setRepoUrl("");
			setRepoBranch("");
			setZipFile(null);
		} else {
			setZipFile(null);
		}
	};

	return (
		<div className="space-y-6 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg">
			<div>
				<h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
					<FolderGit2 className="h-4 w-4 text-orange-500" />
					Code Provider & Source
				</h3>
				<p className="text-xs text-zinc-400 mt-1">
					Choose where your application source code or container image comes from.
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				{sourceOptions.map((option) => {
					const Icon = option.icon;
					const active = sourceType === option.value;
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => handleSourceTypeChange(option.value)}
							className={cn(
								"p-4 rounded-xl border text-left transition-all space-y-1.5 min-w-0",
								active
									? "bg-orange-500/10 border-orange-500/40 text-orange-400 ring-1 ring-orange-500/20"
									: "bg-[#121215] border-[#22222a] text-zinc-400 hover:border-zinc-700",
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<Icon className={cn("h-5 w-5 shrink-0", active ? "text-orange-400" : "text-zinc-500")} />
								<span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
									{option.tag}
								</span>
							</div>
							<div className="font-bold text-xs text-zinc-100">{option.label}</div>
							<p className="text-[11px] text-zinc-400 leading-snug break-words">{option.desc}</p>
						</button>
					);
				})}
			</div>

			{sourceType === "git" && (
				<div className="space-y-4 pt-4 border-t border-[#1a1a22]">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<label className="text-xs font-semibold text-zinc-300">Repository Import Mode</label>
						<div className="flex items-center gap-1 bg-[#121215] p-1 rounded-xl border border-[#22222a] shrink-0">
							<button
								type="button"
								onClick={() => setShowManualGit(false)}
								className={cn(
									"px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
									!showManualGit ? "bg-orange-500 text-white shadow-sm font-bold" : "text-zinc-400 hover:text-zinc-200",
								)}
							>
								<FolderGit2 className="h-3.5 w-3.5" />
								GitHub Account
							</button>
							<button
								type="button"
								onClick={() => setShowManualGit(true)}
								className={cn(
									"px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
									showManualGit ? "bg-orange-500 text-white shadow-sm font-bold" : "text-zinc-400 hover:text-zinc-200",
								)}
							>
								<Link2 className="h-3.5 w-3.5" />
								Manual Git URL
							</button>
						</div>
					</div>

					{!showManualGit ? (
						<RepoPicker
							selected={selectedRepo}
							onSelect={onSelectRepo}
							onDisconnect={onDisconnectGithub}
							onConnect={onConnectGithub}
						/>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#121215] border border-[#22222a]">
							<div className="sm:col-span-2 space-y-1.5">
								<label className="block text-xs font-semibold text-zinc-300">Git Clone URL *</label>
								<Input
									placeholder="https://github.com/user/repository.git"
									value={repoUrl}
									onChange={(e) => setRepoUrl(e.target.value)}
									className="bg-[#181820] border-[#2a2a36] text-xs font-mono text-zinc-100"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="block text-xs font-semibold text-zinc-300">Branch (Optional)</label>
								<Input
									placeholder="main"
									value={repoBranch}
									onChange={(e) => setRepoBranch(e.target.value)}
									className="bg-[#181820] border-[#2a2a36] text-xs font-mono text-zinc-100"
								/>
							</div>
						</div>
					)}

					{!githubConnected && (
						<p className="text-[11px] text-zinc-500">
							{githubConfigured
								? "Connect your GitHub account to browse repositories, or paste any Git URL manually."
								: "GitHub OAuth is not configured. Manual Git URLs and access tokens work for any provider."}
						</p>
					)}

					<div className="p-4 rounded-xl bg-[#121215] border border-[#22222a]">
						<GitAuthFields
							provider={gitProvider}
							setProvider={setGitProvider}
							token={gitToken}
							setToken={setGitToken}
						/>
					</div>
				</div>
			)}

			{sourceType === "image" && (
				<div className="space-y-4 pt-4 border-t border-[#1a1a22]">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#121215] border border-[#22222a]">
						<div className="sm:col-span-2 space-y-1.5">
							<label className="block text-xs font-semibold text-zinc-300">Image Reference *</label>
							<Input
								placeholder="e.g. nginx:alpine or ghcr.io/org/app:v1.2.3"
								value={imageRef}
								onChange={(e) => setImageRef(e.target.value)}
								className="bg-[#181820] border-[#2a2a36] text-xs font-mono text-zinc-100"
							/>
						</div>
						<div className="space-y-1.5">
							<label className="block text-xs font-semibold text-zinc-300">Pull Policy</label>
							<select
								value={imagePullPolicy}
								onChange={(e) => setImagePullPolicy(e.target.value as ImagePullPolicy)}
								className="h-9 w-full rounded-md border border-[#2a2a36] bg-[#181820] px-3 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
							>
								<option value="always">Always pull</option>
								<option value="if-not-present">Pull if not present</option>
								<option value="never">Never pull</option>
							</select>
						</div>
						<div className="space-y-1.5">
							<label className="block text-xs font-semibold text-zinc-300">Registry Credentials</label>
							<select
								value={registryId}
								onChange={(e) => setRegistryId(e.target.value)}
								className="h-9 w-full rounded-md border border-[#2a2a36] bg-[#181820] px-3 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
							>
								<option value="">Public / no credentials</option>
								{registries.map((registry) => (
									<option key={registry.id} value={registry.id}>
										{registry.name} ({registry.url})
									</option>
								))}
							</select>
							<span className="text-[10px] text-zinc-500">Add private registries in Settings → Registries.</span>
						</div>
					</div>
					<p className="text-[11px] text-zinc-500">
						Image deployments start the container directly without building from source. Caddy routing, domains, health
						checks, and restarts apply the same way.
					</p>
				</div>
			)}

			{sourceType === "upload" && (
				<div className="space-y-4 pt-4 border-t border-[#1a1a22]">
					<div className="p-6 border border-dashed border-[#2b2b36] rounded-xl bg-[#121215] text-center space-y-3">
						<Upload className="h-8 w-8 text-emerald-400 mx-auto" />
						<div>
							<p className="text-xs font-bold text-zinc-200">Upload Project Source Code (.zip)</p>
							<p className="text-[11px] text-zinc-400 mt-0.5">
								Ensure your repository root contains your app files or docker-compose.yml file.
							</p>
						</div>
						<input
							type="file"
							accept=".zip"
							onChange={(e) => setZipFile(e.target.files?.[0] || null)}
							className="hidden"
							id="zip-source-input"
						/>
						<Button
							type="button"
							onClick={() => document.getElementById("zip-source-input")?.click()}
							className="bg-[#1c1c24] hover:bg-[#262632] text-zinc-200 text-xs border border-[#2e2e3c]"
						>
							Browse Local ZIP
						</Button>
						{zipFile && (
							<div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-mono pt-2">
								<CheckCircle2 className="h-4 w-4" />
								<span>
									Selected: {zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(2)} MB)
								</span>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
