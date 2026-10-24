import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { AlertTriangle, Layers, Sliders, Terminal } from "lucide-react";
import { useProject } from "../../../hooks/useProjects";
import { cn } from "../../../lib/utils";
import { BuildSettingsSection } from "./BuildSettingsSection";
import { ComposeSettingsSection } from "./ComposeSettingsSection";
import { DeleteProjectCard } from "./DeleteProjectCard";
import { GeneralSettingsSection } from "./GeneralSettingsSection";

interface ProjectSettingsTabProps {
	projectId: string;
}

type SettingsSection = "general" | "build" | "compose" | "danger";

export function ProjectSettingsTab({ projectId }: ProjectSettingsTabProps) {
	const { data: project } = useProject(projectId);
	const location = useLocation();
	const navigate = useNavigate();

	if (!project) return null;

	const isCompose = project.buildType === "compose" || !!(project as any).composeService;

	const { section: sectionFromUrl } = useSearch({ strict: false }) as { section?: SettingsSection | undefined };

	const activeSection: SettingsSection =
		sectionFromUrl && (sectionFromUrl !== "compose" || isCompose) ? sectionFromUrl : "general";

	const handleSectionChange = (section: SettingsSection) => {
		const currentSearch = typeof location.search === "object" && location.search !== null ? location.search : {};
		navigate({ search: { ...currentSearch, tab: "settings", section } as any });
	};

	const navItems: { id: SettingsSection; label: string; icon: typeof Sliders; badge?: string }[] = [
		{ id: "general", label: "General", icon: Sliders },
		{ id: "build", label: "Build Strategy", icon: Terminal },
		...(isCompose ? [{ id: "compose" as const, label: "Docker Compose", icon: Layers, badge: "Compose Stack" }] : []),
		{ id: "danger", label: "Danger Zone", icon: AlertTriangle },
	];

	return (
		<div className="space-y-6">
			<div className="flex flex-col md:flex-row gap-6 items-start">
				{/* Sidebar nav on desktop, horizontal pill bar on mobile */}
				<div className="w-full md:w-56 shrink-0">
					<div className="p-1.5 rounded-xl bg-[#0c0c0e]/80 border border-[#222227] flex md:flex-col gap-1 overflow-x-auto">
						{navItems.map((item) => {
							const Icon = item.icon;
							const isActive = activeSection === item.id;
							const isDanger = item.id === "danger";

							return (
								<button
									key={item.id}
									type="button"
									onClick={() => handleSectionChange(item.id)}
									className={cn(
										"flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap text-left w-full",
										isActive
											? isDanger
												? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
												: "bg-orange-500/10 text-orange-400 border border-orange-500/30 shadow-sm"
											: isDanger
												? "text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5"
												: "text-zinc-400 hover:text-zinc-200 hover:bg-[#141418]",
									)}
								>
									<Icon
										className={cn(
											"h-4 w-4 shrink-0",
											isActive
												? isDanger
													? "text-rose-400"
													: "text-orange-500"
												: isDanger
													? "text-zinc-500"
													: "text-zinc-400",
										)}
									/>
									<span className="flex-1">{item.label}</span>
									{item.badge && (
										<span className="hidden lg:inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
											STACK
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>

				{/* Section content */}
				<div className="flex-1 w-full min-w-0">
					{activeSection === "general" && <GeneralSettingsSection project={project} />}
					{activeSection === "build" && <BuildSettingsSection project={project} />}
					{activeSection === "compose" && isCompose && <ComposeSettingsSection project={project} />}
					{activeSection === "danger" && <DeleteProjectCard projectId={projectId} />}
				</div>
			</div>
		</div>
	);
}
