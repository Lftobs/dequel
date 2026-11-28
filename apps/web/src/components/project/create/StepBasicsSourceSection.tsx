import { useQuery } from "@tanstack/react-query";
import { Container, GitBranch, Upload } from "lucide-react";
import { useState } from "react";
import * as api from "../../../api/client";
import { getGithubAuthUrl } from "../../../api/client";
import { cn } from "../../../lib/utils";
import type { GithubRepo, ImagePullPolicy } from "../../../types";
import { RepoPicker } from "../../github/RepoPicker";
import { Input } from "../../ui/input";
import { GitAuthFields, type GitProviderValue } from "./GitAuthFields";

const sourceOptions = [
	{
		value: "git",
		label: "Git Repository",
		icon: GitBranch,
		desc: "Clone from GitHub or any Git URL",
	},
	{
		value: "upload",
		label: "ZIP Upload",
		icon: Upload,
		desc: "Upload your source code as a ZIP archive",
	},
	{
		value: "image",
		label: "Docker Image",
		icon: Container,
		desc: "Pull a prebuilt image from a registry",
	},
	{
		value: "compose",
		label: "Docker Compose",
		icon: Container,
		desc: "Deploy from a docker-compose.yml file",
	},
];

interface StepBasicsSourceSectionProps {
	sourceType: string;
	setSourceType: (v: string) => void;
	selectedRepo: GithubRepo | null;
	setSelectedRepo: (v: GithubRepo | null) => void;
	repoUrl: string;
	setRepoUrl: (v: string) => void;
	repoBranch: string;
	setRepoBranch: (v: string) => void;
	sourceDir: string;
	setSourceDir: (v: string) => void;
	zipFile: File | null;
	setZipFile: (v: File | null) => void;
	githubConfigured: boolean;
	githubConnected: boolean;
	onGithubConnected: () => boolean;
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

export function StepBasicsSourceSection({
	sourceType,
	setSourceType,
	selectedRepo,
	setSelectedRepo,
	repoUrl,
	setRepoUrl,
	repoBranch,
	setRepoBranch,
	sourceDir,
	setSourceDir,
	zipFile,
	setZipFile,
	onGithubConnected,
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
}: StepBasicsSourceSectionProps) {
	const [showManual, setShowManual] = useState(false);
	const connected = onGithubConnected();
	const { data: registries = [] } = useQuery({
		queryKey: ["registries"],
		queryFn: () => api.listRegistries().catch(() => []),
		enabled: sourceType === "image",
		staleTime: 60_000,
	});

	const handleConnectGithub = async () => {
		try {
			const { url } = await getGithubAuthUrl();
			window.location.href = url;
		} catch (err: any) {
			window.dispatchEvent(
				new CustomEvent("opencode:notification", {
					detail: {
						type: "error",
						message: err.message || "GitHub integration is not configured. Add your credentials in Settings.",
					},
				}),
			);
		}
	};

	const handleSelectRepo = (repo: GithubRepo | null) => {
		setSelectedRepo(repo);
		if (repo) {
			setRepoUrl(repo.cloneUrl);
			setRepoBranch(repo.defaultBranch);
		} else {
			setRepoUrl("");
			setRepoBranch("");
		}
	};

	return (
		<>
			<div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
				<h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
					<Upload className="h-3.5 w-3.5 text-amber-500" />
					Deployment Source
				</h4>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
					{sourceOptions.map((opt) => {
						const Icon = opt.icon;
						const active = sourceType === opt.value;
						return (
							<button
								key={opt.value}
								type="button"
								onClick={() => setSourceType(opt.value)}
								className={cn(
									"relative p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all min-w-0",
									active ? "bg-[#141418] border-amber-500/40 shadow-sm" : "bg-transparent border-zinc-800",
									"hover:border-zinc-700 cursor-pointer",
								)}
							>
								<div
									className={cn(
										"w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
										active ? "bg-amber-500/10 text-amber-400" : "bg-zinc-900 text-zinc-500",
									)}
								>
									<Icon className="h-4 w-4" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-xs font-bold text-zinc-300">{opt.label}</p>
									<p className="text-[9px] text-zinc-500 mt-0.5 leading-normal">{opt.desc}</p>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			{sourceType === "git" && (
				<div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
					<h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
						<GitBranch className="h-3.5 w-3.5 text-amber-500" />
						Git Repository
					</h4>

					{connected ? (
						<div className="space-y-3 max-w-72">
							<RepoPicker
								selected={selectedRepo}
								onSelect={handleSelectRepo}
								onDisconnect={() => {
									setSelectedRepo(null);
									setRepoUrl("");
									setRepoBranch("");
								}}
							/>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setShowManual(!showManual)}
									className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
								>
									{showManual ? "Hide manual input" : "Or paste URL manually"}
								</button>
							</div>
							{showManual ? (
								<ManualGitInputs
									key="manual-git-inputs"
									repoUrl={repoUrl}
									setRepoUrl={setRepoUrl}
									repoBranch={repoBranch}
									setRepoBranch={setRepoBranch}
									showBranch
								/>
							) : (
								<BranchInput key="branch-input" repoBranch={repoBranch} setRepoBranch={setRepoBranch} />
							)}
							<SourceDirInput sourceDir={sourceDir} setSourceDir={setSourceDir} />
						</div>
					) : (
						<div className="space-y-3">
							<button
								type="button"
								onClick={handleConnectGithub}
								className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[#222227] hover:border-amber-500/30 hover:bg-[#0a0a0d] transition-all group"
							>
								<div className="w-9 h-9 rounded-lg bg-[#141418] border border-[#222227] flex items-center justify-center group-hover:border-amber-500/20 group-hover:bg-amber-500/5 transition-all">
									<svg
										className="h-4 w-4 text-zinc-400 group-hover:text-amber-400 transition-colors"
										viewBox="0 0 24 24"
										fill="currentColor"
									>
										<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
									</svg>
								</div>
								<div className="flex-1 text-left">
									<div className="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors">
										Connect GitHub Repository
									</div>
									<div className="text-[10px] text-zinc-500">
										Browse and select from your personal and organization repos
									</div>
								</div>
							</button>

							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setShowManual(!showManual)}
									className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
								>
									{showManual ? "Hide" : "Or enter URL manually"}
								</button>
							</div>

							{showManual && (
								<ManualGitInputs
									key="manual-git-inputs-not-connected"
									repoUrl={repoUrl}
									setRepoUrl={setRepoUrl}
									repoBranch={repoBranch}
									setRepoBranch={setRepoBranch}
									showBranch
								/>
							)}
							<SourceDirInput sourceDir={sourceDir} setSourceDir={setSourceDir} />
						</div>
					)}

					<div className="pt-3.5 border-t border-[#1c1c21]">
						<GitAuthFields
							provider={gitProvider}
							setProvider={setGitProvider}
							token={gitToken}
							setToken={setGitToken}
						/>
					</div>
				</div>
			)}

			{sourceType !== "git" && (
				<div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
					<h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
						<Upload className="h-3.5 w-3.5 text-amber-500" />
						Source Details
					</h4>
					{sourceType === "upload" && (
						<div key="upload-details" className="grid gap-3.5 text-xs">
							<div className="grid gap-1.5">
								<label className="font-semibold text-zinc-400">ZIP Archive</label>
								<label
									htmlFor="zip-upload"
									className={cn(
										"flex items-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all",
										zipFile
											? "border-emerald-500/40 bg-emerald-500/5"
											: "border-[#222227] bg-[#141418] hover:border-zinc-600",
									)}
								>
									<Upload className="h-4 w-4 text-zinc-500" />
									<span className={cn("text-xs", zipFile ? "text-emerald-400" : "text-zinc-400")}>
										{zipFile ? zipFile.name : "Click to select a ZIP file"}
									</span>
								</label>
								<input
									id="zip-upload"
									type="file"
									accept=".zip"
									className="hidden"
									onChange={(e) => {
										const file = e.target.files?.[0] || null;
										setZipFile(file);
									}}
								/>
								{zipFile && (
									<button
										type="button"
										onClick={() => setZipFile(null)}
										className="text-[10px] text-zinc-600 hover:text-zinc-400 self-start"
									>
										Remove file
									</button>
								)}
								<span className="text-[10px] text-zinc-500">
									Upload your source code as a ZIP archive. It will be deployed automatically after project creation.
								</span>
							</div>
						</div>
					)}
					{sourceType === "compose" && (
						<p key="compose-details" className="text-xs text-zinc-500">
							Provide a docker-compose.yml file URL or upload after project creation.
						</p>
					)}
					{sourceType === "image" && (
						<div key="image-details" className="grid gap-3.5 text-xs">
							<div className="grid gap-1.5">
								<label className="font-semibold text-zinc-400">Image Reference</label>
								<Input
									placeholder="e.g. nginx:alpine or ghcr.io/user/app:latest"
									className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9 font-mono"
									value={imageRef}
									onChange={(e) => setImageRef(e.target.value)}
								/>
							</div>
							<div className="grid gap-3.5 sm:grid-cols-2">
								<div className="grid gap-1.5">
									<label className="font-semibold text-zinc-400">Pull Policy</label>
									<select
										value={imagePullPolicy}
										onChange={(e) => setImagePullPolicy(e.target.value as ImagePullPolicy)}
										className="h-9 rounded-md border border-[#222227] bg-[#141418] px-3 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
									>
										<option value="always">Always pull</option>
										<option value="if-not-present">Pull if not present</option>
										<option value="never">Never pull</option>
									</select>
								</div>
								<div className="grid gap-1.5">
									<label className="font-semibold text-zinc-400">Registry Credentials</label>
									<select
										value={registryId}
										onChange={(e) => setRegistryId(e.target.value)}
										className="h-9 rounded-md border border-[#222227] bg-[#141418] px-3 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
									>
										<option value="">Public / no credentials</option>
										{registries.map((registry) => (
											<option key={registry.id} value={registry.id}>
												{registry.name} ({registry.url})
											</option>
										))}
									</select>
									<span className="text-[10px] text-zinc-500">Add private registries in Settings.</span>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</>
	);
}

function ManualGitInputs({
	repoUrl,
	setRepoUrl,
	repoBranch,
	setRepoBranch,
	showBranch,
}: {
	repoUrl: string;
	setRepoUrl: (v: string) => void;
	repoBranch: string;
	setRepoBranch: (v: string) => void;
	showBranch: boolean;
}) {
	return (
		<div className="grid gap-3.5 sm:grid-cols-3 text-xs">
			<div className="grid gap-1.5 sm:col-span-2">
				<label className="font-semibold text-zinc-400">Git Repository URL</label>
				<Input
					placeholder="https://github.com/username/repository.git"
					className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
					value={repoUrl}
					onChange={(e) => {
						setRepoUrl(e.target.value);
					}}
				/>
			</div>
			{showBranch && (
				<div className="grid gap-1.5">
					<label className="font-semibold text-zinc-400">Branch</label>
					<Input
						placeholder="main"
						className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
						value={repoBranch}
						onChange={(e) => setRepoBranch(e.target.value)}
					/>
				</div>
			)}
		</div>
	);
}

function SourceDirInput({ sourceDir, setSourceDir }: { sourceDir: string; setSourceDir: (v: string) => void }) {
	return (
		<div className="grid gap-1.5">
			<label className="font-semibold text-zinc-400">
				Source Directory <span className="text-zinc-600 font-normal">(monorepo)</span>
			</label>
			<Input
				placeholder="e.g. apps/web"
				className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
				value={sourceDir}
				onChange={(e) => setSourceDir(e.target.value)}
			/>
			<span className="text-[10px] text-zinc-500">Leave empty if the app is at the repository root.</span>
		</div>
	);
}

function BranchInput({ repoBranch, setRepoBranch }: { repoBranch: string; setRepoBranch: (v: string) => void }) {
	return (
		<div className="grid gap-3.5 sm:grid-cols-3 text-xs">
			<div className="grid gap-1.5">
				<label className="font-semibold text-zinc-400">Branch</label>
				<Input
					placeholder="main"
					className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
					value={repoBranch}
					onChange={(e) => setRepoBranch(e.target.value)}
				/>
			</div>
		</div>
	);
}
