import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

interface HeaderProps {
	currentProject: { name: string } | undefined;
	currentProjectId: string | null;
	location: { pathname: string; search: any };
}

export function Header({
	currentProject,
	currentProjectId,
	location,
}: HeaderProps) {
	return (
		<header className="h-14 border-b border-[#1a1a1f] bg-[#0c0c0e] flex items-center px-6 gap-2 text-xs text-zinc-500">
			<Link to="/" className="hover:text-zinc-200 transition-colors">
				Workspace
			</Link>
			<ChevronRight className="h-3 w-3 text-zinc-600" />
			{currentProject ? (
				<>
					<Link
						to="/project/$projectId"
						params={{ projectId: currentProjectId! }}
						search={{ tab: "deployments" }}
						className="hover:text-zinc-200 transition-colors font-medium text-zinc-300"
					>
						{currentProject.name}
					</Link>
					<ChevronRight className="h-3 w-3 text-zinc-600" />
					<span className="text-zinc-100 font-bold uppercase tracking-wider text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded">
						{new URLSearchParams(location.search).get("tab") || "deployments"}
					</span>
				</>
			) : (
				<span className="text-zinc-300 font-medium">Dashboard</span>
			)}
		</header>
	);
}
