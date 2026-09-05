import { Share2 } from "lucide-react";
import { SharedEnvVarsSection } from "../components/settings/SharedEnvVarsSection";

export function SharedEnv() {
	return (
		<div className="mx-auto max-w-6xl space-y-7">
			<div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
				<div>
					<p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-amber-500">
						Environment
					</p>
					<h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-100">
						<Share2 className="h-6 w-6 text-zinc-400" />
						Shared Environment Variables
					</h1>
					<p className="mt-2 max-w-2xl text-sm text-zinc-500">
						Define reusable variables once and inject them into any project. Project-level values take precedence.
					</p>
				</div>
			</div>

			<div className="grid gap-6">
				<SharedEnvVarsSection />
			</div>
		</div>
	);
}