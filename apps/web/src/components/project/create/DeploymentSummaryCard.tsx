import { Rocket, Server } from "lucide-react";
import { Button } from "../../ui/button";
import type { ComposeServiceRow } from "./BuildStrategySection";

interface DeploymentSummaryCardProps {
	name: string;
	sourceType: string;
	buildType: string;
	projectType: string;
	port: string;
	composeServicesList: ComposeServiceRow[];
	envCount: number;
	submittingStatus: string;
	canLaunch: boolean;
	onLaunch: () => void;
}

export function DeploymentSummaryCard({
	name,
	sourceType,
	buildType,
	projectType,
	port,
	composeServicesList,
	envCount,
	submittingStatus,
	canLaunch,
	onLaunch,
}: DeploymentSummaryCardProps) {
	return (
		<div className="bg-[#0c0c0e] border border-[#1c1c21] p-5 rounded-2xl space-y-4 sticky top-6 shadow-xl">
			<h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
				<Server className="h-4 w-4 text-orange-500" />
				Deployment Summary
			</h3>

			<div className="space-y-3 text-xs">
				<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
					<div className="text-[10px] text-zinc-400 font-bold uppercase">Project Name</div>
					<div className="font-bold text-zinc-100 font-mono break-all">{name || "—"}</div>
				</div>

				<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
					<div className="text-[10px] text-zinc-400 font-bold uppercase">Code Provider</div>
					<div className="font-bold text-emerald-400 uppercase">{sourceType}</div>
				</div>

				<div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
					<div className="text-[10px] text-zinc-400 font-bold uppercase">Build Strategy</div>
					<div className="font-bold text-amber-400 uppercase">
						{sourceType === "image" ? "prebuilt image" : buildType}
					</div>
				</div>

				{sourceType !== "image" && buildType === "compose" ? (
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
					<div className="text-zinc-300 font-mono text-[11px]">{envCount} variables</div>
				</div>
			</div>

			<Button
				type="button"
				onClick={onLaunch}
				disabled={!canLaunch || (submittingStatus !== "idle" && submittingStatus !== "error")}
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
	);
}
