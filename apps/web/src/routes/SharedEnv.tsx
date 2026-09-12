import { useQuery } from "@tanstack/react-query";
import { Info, Layers, Share2, Shield } from "lucide-react";
import * as api from "../api/client";
import { SharedEnvVarsSection } from "../components/settings/SharedEnvVarsSection";
import { Badge } from "../components/ui/badge";

export function SharedEnv() {
	const { data: vars = [] } = useQuery({
		queryKey: ["shared-env-vars"],
		queryFn: () => api.listSharedEnvVars().catch(() => []),
	});

	return (
		<div className="mx-auto max-w-6xl space-y-8 pb-12">
			{/* Hero Header */}
			<div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 via-card/40 to-background p-6 md:p-8 backdrop-blur-md shadow-2xl">
				<div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
				<div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

				<div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Badge
								variant="outline"
								className="border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5"
							>
								Global Environment Store
							</Badge>
						</div>
						<h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
							<Share2 className="h-7 w-7 text-orange-500" />
							Shared Environment Variables
						</h1>
						<p className="max-w-2xl text-xs md:text-sm text-muted-foreground leading-relaxed">
							Define global secrets, API keys, and configuration variables once to share across all project containers.
							Project-specific variables take precedence.
						</p>
					</div>

					<div className="w-full grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap items-center sm:gap-3">
						<div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-inner">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
								<Layers className="h-4 w-4" />
							</div>
							<div>
								<div className="text-xs font-semibold text-foreground">{vars.length} Active</div>
								<div className="text-[10px] text-muted-foreground">Global Variables</div>
							</div>
						</div>

						<div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-inner">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
								<Shield className="h-4 w-4" />
							</div>
							<div>
								<div className="text-xs font-semibold text-foreground">Encrypted</div>
								<div className="text-[10px] text-muted-foreground">At Rest Storage</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Variable Inheritance Tip Callout */}
			<div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm flex items-start gap-3">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 shrink-0 mt-0.5">
					<Info className="h-4 w-4" />
				</div>
				<div className="space-y-1">
					<h4 className="text-xs font-semibold text-foreground">Variable Precedence Hierarchy</h4>
					<p className="text-xs text-muted-foreground leading-relaxed">
						Shared variables are automatically merged into runtime environments for all deployed applications. If a
						project defines an environment variable with the exact same key name, the project-level value will override
						the shared value.
					</p>
				</div>
			</div>

			<div className="grid gap-6">
				<SharedEnvVarsSection />
			</div>
		</div>
	);
}
