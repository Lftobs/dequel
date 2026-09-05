import { Rocket } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { ClearCacheToggle } from "./clear-cache-toggle";

interface ManualDeployDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	projectName: string;
	repoUrl: string | null | undefined;
	repoBranch: string | null | undefined;
	isPending: boolean;
	onDeploy: (form: FormData) => Promise<void>;
}

export function ManualDeployDialog({
	open,
	onOpenChange,
	projectName,
	repoUrl,
	repoBranch,
	isPending,
	onDeploy,
}: ManualDeployDialogProps) {
	const [deployOption, setDeployOption] = useState<"latest" | "commit">("latest");
	const [commitSha, setCommitSha] = useState("");
	const [clearCache, setClearCache] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDeploy = async () => {
		const form = new FormData();
		form.set("sourceType", "git");
		if (repoUrl) form.set("gitUrl", repoUrl);
		if (repoBranch) form.set("branch", repoBranch);

		if (deployOption === "commit") {
			if (!commitSha.trim()) return;
			form.set("commitSha", commitSha.trim());
		}

		if (clearCache) {
			form.set("clearCache", "true");
		}

		try {
			await onDeploy(form);
			setDeployOption("latest");
			setCommitSha("");
			setClearCache(false);
			setError(null);
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start deployment");
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) setError(null);
				onOpenChange(v);
			}}
		>
			<DialogContent className="sm:max-w-[480px] bg-[#0c0c0e] border-[#1d1d22] text-zinc-100">
				<DialogHeader>
					<DialogTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2">
						<Rocket className="h-5 w-5 text-amber-500" />
						Manual Deployment
					</DialogTitle>
					<DialogDescription className="text-zinc-500 text-xs">
						Build and deploy a new version of <span className="text-zinc-300 font-semibold">{projectName}</span>.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Deployment Option</label>
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setDeployOption("latest")}
								className={cn(
									"flex flex-col items-start p-3 rounded-lg border text-left transition-all",
									deployOption === "latest"
										? "bg-amber-500/10 border-amber-500 text-amber-400"
										: "bg-[#121215] border-[#222227] text-zinc-400 hover:border-[#33333b] hover:text-zinc-200",
								)}
							>
								<span className="text-xs font-bold">Latest Commit</span>
								<span className="text-[10px] opacity-75 mt-0.5">Deploy HEAD from {repoBranch || "main"}</span>
							</button>
							<button
								type="button"
								onClick={() => setDeployOption("commit")}
								className={cn(
									"flex flex-col items-start p-3 rounded-lg border text-left transition-all",
									deployOption === "commit"
										? "bg-amber-500/10 border-amber-500 text-amber-400"
										: "bg-[#121215] border-[#222227] text-zinc-400 hover:border-[#33333b] hover:text-zinc-200",
								)}
							>
								<span className="text-xs font-bold">Specific Commit</span>
								<span className="text-[10px] opacity-75 mt-0.5">Specify a commit hash/SHA</span>
							</button>
						</div>
					</div>

					{deployOption === "commit" && (
						<div className="space-y-1.5 animate-in fade-in-50 duration-200">
							<label className="text-xs font-semibold text-zinc-400">Commit SHA / Hash</label>
							<Input
								placeholder="e.g. a1b2c3d4e5f6..."
								value={commitSha}
								onChange={(e) => setCommitSha(e.target.value)}
								className="bg-[#121215] border-[#222227] text-zinc-200 focus:border-amber-500 text-xs font-mono h-9"
							/>
						</div>
					)}

					<ClearCacheToggle
						checked={clearCache}
						onChange={setClearCache}
						id="clearCacheManual"
						label="Clear build cache"
						description="Bypasses cached Buildkit stages to force a clean dependency fetch and build."
					/>
				</div>

				{error && (
					<div className="px-6 pb-2">
						<div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
							{error}
						</div>
					</div>
				)}
				<DialogFooter className="border-t border-[#1d1d22] pt-4 gap-2 sm:gap-0">
					<Button
						type="button"
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="text-zinc-400 hover:text-zinc-200 text-xs h-9"
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleDeploy}
						disabled={isPending || (deployOption === "commit" && !commitSha.trim())}
						className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-9 px-4 flex items-center gap-2"
					>
						{isPending ? "Deploying..." : "Start Deployment"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
