import { Link } from "@tanstack/react-router";
import {
	Box,
	Settings,
	Activity,
	Terminal,
	Sliders,
	Globe,
	Database,
	Bell,
	Layers,
	ArrowUpRight,
	TrendingUp,
	Laptop,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface SidebarNavProps {
	currentProjectId: string | null;
	currentProject: { name: string } | undefined;
	location: { pathname: string; search: any };
	navigate: (opts: any) => void;
}

export function SidebarNav({
	currentProjectId,
	currentProject,
	location,
	navigate,
}: SidebarNavProps) {
	const isTabActive = (tabName: string) => {
		const activeTab =
			new URLSearchParams(location.search).get("tab") || "deployments";
		return activeTab === tabName;
	};

	return (
		<div className="flex-1 overflow-y-auto p-3 space-y-6">
			<div>
				<h4 className="px-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
					Dashboards
				</h4>
				<nav className="space-y-0.5">
					<Link
						to="/"
						className={cn(
							"flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all duration-200",
							location.pathname === "/" && !currentProjectId
								? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner"
								: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
						)}
					>
						<Box className="h-4 w-4" />
						Projects
					</Link>
					<Link
						to="/settings"
						className={cn(
							"flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all duration-200",
							location.pathname.startsWith("/settings")
								? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner"
								: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
						)}
					>
						<Settings className="h-4 w-4" />
						Settings
					</Link>
				</nav>
			</div>

			{currentProject && (
				<div className="animate-in fade-in slide-in-from-left-2 duration-200">
					<div className="flex items-center justify-between px-3 mb-2">
						<h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
							Project Control
						</h4>
						<span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase tracking-tight scale-90">
							Active
						</span>
					</div>
					<nav className="space-y-0.5">
						<button
							onClick={() =>
								navigate({
									to: `/project/${currentProjectId}`,
									search: { tab: "deployments" },
								})
							}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200",
								isTabActive("deployments")
									? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
							)}
						>
							<Layers className="h-4 w-4 text-zinc-400" />
							Deployments
						</button>

						<button
							onClick={() =>
								navigate({
									to: `/project/${currentProjectId}`,
									search: { tab: "env-vars" },
								})
							}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200",
								isTabActive("env-vars")
									? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
							)}
						>
							<Sliders className="h-4 w-4 text-zinc-400" />
							Env Variables
						</button>

						<button
							onClick={() =>
								navigate({
									to: `/project/${currentProjectId}`,
									search: { tab: "domains" },
								})
							}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200",
								isTabActive("domains")
									? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
							)}
						>
							<Globe className="h-4 w-4 text-zinc-400" />
							Domains
						</button>

						<button
							onClick={() =>
								navigate({
									to: `/project/${currentProjectId}`,
									search: { tab: "databases" },
								})
							}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200",
								isTabActive("databases")
									? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
							)}
						>
							<Database className="h-4 w-4 text-zinc-400" />
							Databases & Volumes
						</button>

						<button
							onClick={() =>
								navigate({
									to: `/project/${currentProjectId}`,
									search: { tab: "scaling" },
								})
							}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200",
								isTabActive("scaling")
									? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
							)}
						>
							<TrendingUp className="h-4 w-4 text-zinc-400" />
							Auto Scaling
						</button>

						<button
							onClick={() =>
								navigate({
									to: `/project/${currentProjectId}`,
									search: { tab: "alerts" },
								})
							}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200",
								isTabActive("alerts")
									? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
							)}
						>
							<Bell className="h-4 w-4 text-zinc-400" />
							Alerts Policies
						</button>
					</nav>
				</div>
			)}

			{currentProject && (
				<div className="animate-in fade-in slide-in-from-left-2 duration-200">
					<h4 className="px-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
						Observability
					</h4>
					<nav className="space-y-0.5">
						<button
							onClick={() =>
								navigate({
									to: `/project/${currentProjectId}`,
									search: { tab: "observability" },
								})
							}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200",
								isTabActive("observability")
									? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
							)}
						>
							<Activity className="h-4 w-4 text-zinc-400" />
							Overview Metrics
						</button>
						<button
							onClick={() =>
								navigate({
									to: `/project/${currentProjectId}`,
									search: { tab: "logs" },
								})
							}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200",
								isTabActive("logs")
									? "bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]",
							)}
						>
							<Terminal className="h-4 w-4 text-zinc-400" />
							Real-time Logs
						</button>
						<a
							href="/grafana"
							target="_blank"
							rel="noreferrer"
							className="flex items-center justify-between px-3 py-2 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#141417] transition-all"
						>
							<span className="flex items-center gap-2.5">
								<Laptop className="h-4 w-4 text-zinc-400" />
								Open Grafana
							</span>
							<ArrowUpRight className="h-3 w-3 text-zinc-500" />
						</a>
					</nav>
				</div>
			)}
		</div>
	);
}
