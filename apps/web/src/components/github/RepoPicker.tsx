import { useState, useEffect } from "react";
import { getGithubRepos, disconnectGithub } from "../../api/client";
import type { GithubRepo } from "../../types";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, X, GitFork, Lock, Globe, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

interface RepoPickerProps {
	onSelect: (repo: GithubRepo) => void;
	selected: GithubRepo | null;
	onDisconnect: () => void;
}

export function RepoPicker({ onSelect, selected, onDisconnect }: RepoPickerProps) {
	const [repos, setRepos] = useState<GithubRepo[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [error, setError] = useState("");

	const fetchRepos = async () => {
		setLoading(true);
		setError("");
		try {
			const data = await getGithubRepos();
			setRepos(data);
		} catch (err) {
			setError("Failed to load repositories. Reconnect GitHub.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { fetchRepos(); }, []);

	const filtered = repos.filter((r) =>
		r.fullName.toLowerCase().includes(search.toLowerCase()),
	);

	if (selected) {
		return (
			<div className="space-y-2">
				<div className="flex items-center gap-2 p-3 rounded-xl bg-[#0a0a0d] border border-[#222227]">
					<div className="w-8 h-8 rounded-lg bg-[#141418] border border-[#222227] flex items-center justify-center shrink-0">
						<svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-xs font-semibold text-zinc-200 truncate">
							{selected.fullName}
						</div>
						<div className="text-[10px] text-zinc-500">
							{selected.private ? "Private" : "Public"} &middot; {selected.defaultBranch}
						</div>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onSelect(null as any)}
						className="h-7 text-[10px] px-2 text-zinc-500 hover:text-zinc-200"
					>
						Change
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="relative">
				<Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
				<Input
					placeholder="Search repositories..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="h-9 pl-8 bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs"
				/>
			</div>

			{loading ? (
				<div className="flex items-center justify-center py-8 text-zinc-500 text-xs">
					<RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
					Loading repositories...
				</div>
			) : error ? (
				<div className="flex flex-col items-center gap-2 py-8">
					<p className="text-xs text-zinc-500">{error}</p>
					<Button
						variant="outline"
						size="sm"
						onClick={fetchRepos}
						className="h-8 text-xs border-[#222227]"
					>
						Retry
					</Button>
				</div>
			) : filtered.length === 0 ? (
				<div className="text-center py-8 text-zinc-500 text-xs">
					{search ? "No matching repositories." : "No repositories found."}
				</div>
			) : (
				<div className="max-h-64 overflow-y-auto space-y-1 pr-1">
					{filtered.map((repo) => (
						<button
							key={repo.id}
							onClick={() => onSelect(repo)}
							className="w-full text-left p-2.5 rounded-lg hover:bg-[#141418] border border-transparent hover:border-[#222227] transition-all flex items-start gap-2.5 group"
						>
							<div className="w-7 h-7 rounded-md bg-[#141418] border border-[#222227] flex items-center justify-center shrink-0 mt-0.5">
								<GitFork className="h-3.5 w-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-amber-400 transition-colors">
										{repo.fullName}
									</span>
									{repo.private ? (
										<Lock className="h-3 w-3 text-zinc-600 shrink-0" />
									) : (
										<Globe className="h-3 w-3 text-zinc-600 shrink-0" />
									)}
								</div>
								{repo.description && (
									<p className="text-[10px] text-zinc-500 truncate mt-0.5">
										{repo.description}
									</p>
								)}
								<div className="flex items-center gap-2 mt-1">
									{repo.language && (
										<span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
											{repo.language}
										</span>
									)}
									<span className="text-[9px] text-zinc-600">
										{repo.defaultBranch}
									</span>
								</div>
							</div>
						</button>
					))}
				</div>
			)}

			<div className="flex justify-between items-center pt-2 border-t border-[#1a1a1f]">
				<button
					onClick={async () => {
						await disconnectGithub();
						onDisconnect();
					}}
					className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
				>
					Disconnect GitHub
				</button>
				{repos.length > 0 && (
					<span className="text-[10px] text-zinc-600">
						{filtered.length} of {repos.length} repos
					</span>
				)}
			</div>
		</div>
	);
}
