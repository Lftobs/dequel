import { CheckCircle2, Container, FolderGit2, GitBranch, Upload } from "lucide-react";
import type { GithubRepo } from "../../../types";

interface ImportHeaderCardProps {
	sourceType: "git" | "upload" | "compose";
	selectedRepo: GithubRepo | null;
	repoUrl: string;
	repoBranch: string;
	zipFile: File | null;
}

export function ImportHeaderCard({ sourceType, selectedRepo, repoUrl, repoBranch, zipFile }: ImportHeaderCardProps) {
	const getRepoDisplayName = () => {
		if (selectedRepo) return selectedRepo.fullName;
		if (repoUrl) {
			try {
				const url = new URL(repoUrl);
				return url.pathname.replace(/^\//, "").replace(/\.git$/, "");
			} catch {
				return repoUrl;
			}
		}
		return "Custom Git Repository";
	};

	return (
		<div className="bg-[#0e0e12] border border-[#1e1e26] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
			<div className="flex items-center gap-3.5 min-w-0">
				<div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 shrink-0">
					{sourceType === "git" ? (
						<FolderGit2 className="h-5 w-5" />
					) : sourceType === "upload" ? (
						<Upload className="h-5 w-5" />
					) : (
						<Container className="h-5 w-5" />
					)}
				</div>
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
							Importing from{" "}
							{sourceType === "git" ? "GitHub" : sourceType === "upload" ? "ZIP Archive" : "Docker Compose"}
						</span>
						<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
					</div>
					<div className="flex items-center gap-2 mt-1">
						<span className="font-bold text-sm text-zinc-100 truncate">
							{sourceType === "git"
								? getRepoDisplayName()
								: sourceType === "upload"
									? zipFile?.name || "Uploaded Source ZIP"
									: "docker-compose.yml"}
						</span>
						{sourceType === "git" && (
							<span className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-[#16161f] border border-[#262634] px-2 py-0.5 rounded-md font-mono shrink-0">
								<GitBranch className="h-3 w-3 text-orange-400" />
								{repoBranch || selectedRepo?.defaultBranch || "main"}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
