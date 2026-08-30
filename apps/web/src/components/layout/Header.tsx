import { Link } from "@tanstack/react-router";
import { ChevronRight, Menu } from "lucide-react";

interface HeaderProps {
	currentProject: { name: string } | undefined;
	currentProjectId: string | null;
	location: { pathname: string; search: any };
	setSidebarOpen: (open: boolean) => void;
}

export function Header({
	currentProject,
	currentProjectId,
	location,
	setSidebarOpen,
}: HeaderProps) {
	return (
		<header className="h-14 border-b border-[#1a1a1f] bg-[#0c0c0e] flex items-center justify-between px-3.5 sm:px-6 gap-2 text-xs text-zinc-500 sticky top-0 z-30">
			<div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
				<button
					onClick={() => setSidebarOpen(true)}
					className="lg:hidden p-2 -ml-1 mr-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
					aria-label="Open sidebar"
				>
					<Menu className="h-5 w-5" />
				</button>

				<Link to="/" className="hover:text-zinc-200 transition-colors shrink-0">
					Workspace
				</Link>
				<ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" />
				{currentProject ? (
					<>
						<Link
							to="/project/$projectId"
							params={{ projectId: currentProjectId! }}
							search={{ tab: "deployments" }}
							className="hover:text-zinc-200 transition-colors font-medium text-zinc-300 truncate max-w-[110px] sm:max-w-[200px]"
						>
							{currentProject.name}
						</Link>
						<ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" />
						<span className="text-zinc-100 font-bold uppercase tracking-wider text-[9px] sm:text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
							{new URLSearchParams(location.search).get("tab") || "deployments"}
						</span>
					</>
				) : (
					<span className="text-zinc-300 font-medium truncate">Dashboard</span>
				)}
			</div>
		</header>
	);
}
