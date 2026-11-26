import type { GitProvider } from "../../../types";
import { Input } from "../../ui/input";

export type GitProviderValue = GitProvider | "";

const PROVIDERS: Array<{ value: GitProviderValue; label: string }> = [
	{ value: "", label: "Auto-detect from URL" },
	{ value: "github", label: "GitHub" },
	{ value: "gitlab", label: "GitLab" },
	{ value: "bitbucket", label: "Bitbucket" },
	{ value: "gitea", label: "Gitea / Forgejo" },
	{ value: "generic", label: "Generic HTTPS Git" },
];

interface GitAuthFieldsProps {
	provider: GitProviderValue;
	setProvider: (value: GitProviderValue) => void;
	token: string;
	setToken: (value: string) => void;
	hasStoredToken?: boolean;
	compact?: boolean;
}

export function GitAuthFields({ provider, setProvider, token, setToken, hasStoredToken, compact }: GitAuthFieldsProps) {
	return (
		<div className={compact ? "grid gap-3 text-xs" : "grid gap-3.5 sm:grid-cols-2 text-xs"}>
			<div className="grid gap-1.5">
				<label className="font-semibold text-zinc-400">Git Provider</label>
				<select
					value={provider}
					onChange={(e) => setProvider(e.target.value as GitProviderValue)}
					className="h-9 rounded-md border border-[#222227] bg-[#141418] px-3 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
				>
					{PROVIDERS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
				<span className="text-[10px] text-zinc-500">Used to pick the right HTTPS credentials for clones.</span>
			</div>
			<div className="grid gap-1.5">
				<label className="font-semibold text-zinc-400">
					Access Token <span className="text-zinc-600 font-normal">(private repos)</span>
				</label>
				<Input
					type="password"
					placeholder={hasStoredToken ? "Stored token - leave blank to keep" : "ghp_... or glpat-..."}
					value={token}
					onChange={(e) => setToken(e.target.value)}
					className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9 font-mono"
					autoComplete="off"
				/>
				<span className="text-[10px] text-zinc-500">Encrypted at rest. Sent only to the Git host during builds.</span>
			</div>
		</div>
	);
}
