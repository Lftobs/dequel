import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { useEffect, useRef } from "react";
import { AlertsTab } from "../components/project/alerts/AlertsTab";
import { DeploymentsTab } from "../components/project/deployments/DeploymentsTab";
import { DomainsTab } from "../components/project/domains/DomainsTab";
import { EnvVarsTab } from "../components/project/envtab/EnvVarsTab";
import { LogsTab } from "../components/project/logs/LogsTab";
import { ObservabilityTab } from "../components/project/observability/ObservabilityTab";
import { ScalingTab } from "../components/project/scaling/ScalingTab";
import { ProjectSettingsTab } from "../components/project/settings/ProjectSettingsTab";
import { VolumesTab } from "../components/project/volumes/VolumesTab";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useDeployments } from "../hooks/useDeployments";
import { useProject } from "../hooks/useProjects";

export function ProjectDetail({ projectId }: { projectId: string }) {
	const { data: project, isLoading } = useProject(projectId);
	const { data: deploymentsData } = useDeployments(projectId, 0, 10);
	const navigate = useNavigate();
	const location = useLocation();
	const activeTab = new URLSearchParams(location.search).get("tab") || "deployments";
	const tabsListRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!tabsListRef.current) return;
		const activeTrigger = tabsListRef.current.querySelector(`[data-value="${activeTab}"]`) as HTMLElement | null;
		if (activeTrigger) {
			activeTrigger.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
		}
	}, [activeTab]);

	if (isLoading)
		return (
			<div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 select-none">
				<div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
				<div className="text-zinc-500 text-xs tracking-wider uppercase font-mono">Loading Service Config...</div>
			</div>
		);
	if (!project)
		return (
			<div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 select-none">
				<div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1a1a1f] to-[#121215] border border-[#222227] flex items-center justify-center mb-6 shadow-xl relative overflow-hidden group">
					<div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
					<FolderKanban className="h-7 w-7 text-amber-500" />
				</div>
				<h2 className="text-2xl font-bold text-zinc-100 tracking-tight mb-2">Project Not Found</h2>
				<p className="text-zinc-500 text-xs max-w-sm leading-normal mb-8">
					The project you are looking for does not exist, has been deleted, or you might not have access to it in this
					workspace.
				</p>
				<Button
					onClick={() => navigate({ to: "/" })}
					className="bg-[#141418] border border-[#222227] hover:bg-[#1a1a21] hover:border-[#33333b] text-zinc-350 hover:text-white text-xs h-9 px-5 rounded-lg flex items-center gap-2 transition-all shadow-md"
				>
					<ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
				</Button>
			</div>
		);

	const activeDeployment = deploymentsData?.items?.find((d) => d.status === "running");
	const liveUrl = activeDeployment?.liveUrl;

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/" })}
					className="h-8 w-8 text-muted-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
					{project.name.charAt(0).toUpperCase()}
				</div>
				<div>
					<div className="flex items-center gap-3">
						<h1 className="text-xl font-bold text-foreground">{project.name}</h1>
						{liveUrl && (
							<a
								href={liveUrl}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded-full transition-all duration-200"
							>
								{liveUrl} ↗
							</a>
						)}
					</div>
					{project.description && <p className="text-muted-foreground text-sm mt-0.5">{project.description}</p>}
				</div>
			</div>

			<Tabs value={activeTab} onValueChange={(val) => navigate({ search: { tab: val } as any })} className="space-y-4">
				<TabsList
					ref={tabsListRef}
					className="mb-6 flex overflow-x-auto whitespace-nowrap justify-start h-auto p-1 bg-[#141417] border border-[#222227] rounded-lg max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					<TabsTrigger
						value="deployments"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Deployments
					</TabsTrigger>
					<TabsTrigger
						value="env-vars"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Env Vars
					</TabsTrigger>
					<TabsTrigger
						value="volumes"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Volumes
					</TabsTrigger>
					<TabsTrigger
						value="domains"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Domains
					</TabsTrigger>
					<TabsTrigger
						value="scaling"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Scaling
					</TabsTrigger>
					<TabsTrigger
						value="alerts"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Alerts
					</TabsTrigger>
					<TabsTrigger
						value="observability"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Observability
					</TabsTrigger>
					<TabsTrigger
						value="logs"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Logs
					</TabsTrigger>
					<TabsTrigger
						value="settings"
						className="text-xs px-3 py-1.5 rounded-md shrink-0 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
					>
						Settings
					</TabsTrigger>
				</TabsList>

				<TabsContent value="deployments">
					<DeploymentsTab projectId={projectId} />
				</TabsContent>
				<TabsContent value="env-vars">
					<EnvVarsTab projectId={projectId} />
				</TabsContent>
				<TabsContent value="volumes">
					<VolumesTab projectId={projectId} />
				</TabsContent>
				<TabsContent value="domains">
					<DomainsTab projectId={projectId} />
				</TabsContent>
				<TabsContent value="scaling">
					<ScalingTab projectId={projectId} />
				</TabsContent>
				<TabsContent value="alerts">
					<AlertsTab projectId={projectId} />
				</TabsContent>
				<TabsContent value="observability">
					<ObservabilityTab projectId={projectId} />
				</TabsContent>
				<TabsContent value="logs">
					<LogsTab projectId={projectId} />
				</TabsContent>
				<TabsContent value="settings">
					<ProjectSettingsTab projectId={projectId} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
