import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { DequelLogo } from "../DequelLogo";

interface Project {
	id: string;
	name: string;
}

interface ProjectSelectorProps {
	projects: Project[];
	currentProject: Project | undefined;
	currentProjectId: string | null;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
}

export function ProjectSelector({
	projects,
	currentProject,
	currentProjectId,
	isOpen,
	setIsOpen,
}: ProjectSelectorProps) {
	return (
		<div className="p-4 border-b border-[#1a1a1f] relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-[#141417] border border-[#222227] hover:bg-[#1c1c21] hover:border-[#33333b] transition-all duration-200"
			>
				<div className="flex items-center gap-2.5 min-w-0">
					{currentProject ? (
						<div className="w-6 h-6 rounded-md bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-[10px] font-display font-black text-white shadow-sm shrink-0">
							{currentProject.name
								.slice(0, 2)
								.toUpperCase()}
						</div>
					) : (
						<DequelLogo className="w-6 h-6 shrink-0" />
					)}
					<span className="font-display font-semibold text-xs truncate text-zinc-200">
						{currentProject ? currentProject.name : "All Projects"}
					</span>
				</div>
				<ChevronDown
					className={cn(
						"h-3.5 w-3.5 text-zinc-500 transition-transform duration-200",
						isOpen && "transform rotate-180",
					)}
				/>
			</button>

			{isOpen && (
				<>
					<div
						className="fixed inset-0 z-10"
						onClick={() => setIsOpen(false)}
					/>
					<div className="absolute top-[calc(100%-8px)] left-4 right-4 mt-2 py-1.5 rounded-lg border border-[#27272a] bg-[#111113] shadow-xl z-20 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
						<Link
							to="/"
							onClick={() => setIsOpen(false)}
							className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1a1e] transition-colors"
						>
							<DequelLogo className="h-3.5 w-3.5" />
							<span>All Projects</span>
						</Link>
						<div className="h-[1px] bg-[#1d1d21] my-1" />
						{projects.map((p) => (
							<Link
								key={p.id}
								to="/project/$projectId"
								params={{ projectId: p.id }}
								search={{ tab: "deployments" } as any}
								onClick={() => setIsOpen(false)}
								className={cn(
									"flex items-center justify-between px-3 py-2 text-xs transition-colors",
									p.id === currentProjectId
										? "bg-amber-500/10 text-amber-400 font-medium"
										: "text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1a1e]",
								)}
							>
								<div className="flex items-center gap-2 min-w-0">
									<div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center text-[8px] font-display font-black text-zinc-300">
										{p.name.charAt(0).toUpperCase()}
									</div>
									<span className="truncate font-display">{p.name}</span>
								</div>
							</Link>
						))}
					</div>
				</>
			)}
		</div>
	);
}
