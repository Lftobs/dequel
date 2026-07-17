import { DequelLogo } from "../DequelLogo";
import { ProjectSelector } from "./ProjectSelector";
import { SidebarNav } from "./SidebarNav";
import { NodeStatusCard } from "./NodeStatusCard";
import { SupportSection } from "./SupportSection";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

interface Project {
	id: string;
	name: string;
}

interface SidebarProps {
	projects: Project[];
	currentProject: Project | undefined;
	currentProjectId: string | null;
	projectSelectorOpen: boolean;
	setProjectSelectorOpen: (open: boolean) => void;
	metrics: any;
	location: { pathname: string; search: any };
	navigate: (opts: any) => void;
	sidebarOpen: boolean;
	setSidebarOpen: (open: boolean) => void;
}

export function Sidebar({
	projects,
	currentProject,
	currentProjectId,
	projectSelectorOpen,
	setProjectSelectorOpen,
	metrics,
	location,
	navigate,
	sidebarOpen,
	setSidebarOpen,
}: SidebarProps) {
	return (
		<>
			{/* Mobile Backdrop */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			<aside
				className={cn(
					"w-64 border-r border-[#1a1a1f] bg-[#0c0c0e] shrink-0 flex flex-col justify-between select-none overflow-y-auto",
					"fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out",
					sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
				)}
			>
				<div className="flex flex-col flex-1 min-h-0">
					<div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-[#1a1a1f]">
						<div className="flex items-center gap-2.5">
							<DequelLogo className="h-6 w-6" />
							<span className="font-display font-black text-base tracking-wider bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
								dequel
							</span>
							<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono font-bold scale-90">
								v{__DEQUEL_VERSION__}
							</span>
						</div>
						<button
							onClick={() => setSidebarOpen(false)}
							className="lg:hidden p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
							aria-label="Close Sidebar"
						>
							<X className="h-4 w-4" />
						</button>
					</div>

					<ProjectSelector
						projects={projects}
						currentProject={currentProject}
						currentProjectId={currentProjectId}
						isOpen={projectSelectorOpen}
						setIsOpen={setProjectSelectorOpen}
					/>

					<SidebarNav
						currentProjectId={currentProjectId}
						currentProject={currentProject}
						location={location}
						navigate={navigate}
					/>
				</div>

				<div className="p-4 border-t border-[#1a1a1f] space-y-4">
					<NodeStatusCard metrics={metrics} />
					<SupportSection />
					<div className="flex items-center justify-between text-[10px] text-zinc-600">
						<span>Dequel Platform v{__DEQUEL_VERSION__}</span>
					</div>
				</div>
			</aside>
		</>
	);
}
