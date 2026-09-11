import { Box, Globe } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { Server as DequelServer } from "../../../types";
import type { FrameworkPreset } from "../../../utils/presets";
import { FRAMEWORK_PRESETS } from "../../../utils/presets";
import { FrameworkSelect } from "../../ui/FrameworkSelect";
import { Input } from "../../ui/input";
import { DeploymentTargetSelect } from "./DeploymentTargetSection";

interface StepBasicsGeneralSettingsProps {
	name: string;
	setName: (v: string) => void;
	description: string;
	setDescription: (v: string) => void;
	baseDomain: string;
	setBaseDomain: (v: string) => void;
	projectType: string;
	setProjectType: (v: string) => void;
	selectedPresetId: string;
	onSelectPreset: (preset: FrameworkPreset) => void;
	serverId: string;
	setServerId: (v: string) => void;
	servers: DequelServer[];
}

export function StepBasicsGeneralSettings({
	name,
	setName,
	description,
	setDescription,
	baseDomain,
	setBaseDomain,
	projectType,
	setProjectType,
	selectedPresetId,
	onSelectPreset,
	serverId,
	setServerId,
	servers,
}: StepBasicsGeneralSettingsProps) {
	const handleTypeChange = (type: string) => {
		const preset = FRAMEWORK_PRESETS.find((p) => p.id === selectedPresetId);
		if (preset && preset.projectType === type) {
			setProjectType(type);
			return;
		}
		setProjectType(type);
	};

	return (
		<div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
			<h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
				<Globe className="h-3.5 w-3.5 text-amber-500" />
				General Settings
			</h4>
			<div className="grid gap-3.5 sm:grid-cols-2 text-xs">
				<div className="grid gap-1.5 sm:col-span-2">
					<label htmlFor="name" className="font-semibold text-zinc-400">
						Project Name *
					</label>
					<Input
						id="name"
						placeholder="e.g. my-awesome-app"
						className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
					/>
				</div>
				<div className="grid gap-1.5 sm:col-span-2">
					<label htmlFor="desc" className="font-semibold text-zinc-400">
						Description
					</label>
					<Input
						id="desc"
						placeholder="e.g. Frontend React static dashboard"
						className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</div>

				<div className="grid gap-1.5 sm:col-span-2">
					<label className="font-semibold text-zinc-400">Application Framework Preset</label>
					<FrameworkSelect selectedPresetId={selectedPresetId} onSelectPreset={onSelectPreset} />
				</div>

				<div className="sm:col-span-2">
					<DeploymentTargetSelect serverId={serverId} setServerId={setServerId} servers={servers} />
				</div>

				<div className="grid gap-1.5 sm:col-span-2">
					<label className="font-semibold text-zinc-400">Project Type</label>
					<div className="grid grid-cols-2 gap-2 mt-0.5">
						<button
							type="button"
							onClick={() => handleTypeChange("web")}
							className={cn(
								"flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-all select-none active:scale-[0.98]",
								projectType === "web"
									? "border-amber-500/30 bg-amber-500/5 text-zinc-200"
									: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400",
							)}
						>
							<div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-200">
								<Box className="h-4 w-4 text-amber-500" />
								Web Application
							</div>
							<span className="text-[10px] text-zinc-500 leading-normal">
								For Node, Go, Rust, APIs, or database-connected backends.
							</span>
						</button>
						<button
							type="button"
							onClick={() => handleTypeChange("static")}
							className={cn(
								"flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-all select-none active:scale-[0.98]",
								projectType === "static"
									? "border-amber-500/30 bg-amber-500/5 text-zinc-200"
									: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400",
							)}
						>
							<div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-200">
								<Globe className="h-4 w-4 text-amber-500" />
								Static Site
							</div>
							<span className="text-[10px] text-zinc-500 leading-normal">
								For React, Vite, Astro, Vue, Docusaurus, or static HTML.
							</span>
						</button>
					</div>
				</div>
				<div className="grid gap-1.5 sm:col-span-2">
					<label htmlFor="domain" className="font-semibold text-zinc-400">
						Custom Ingress Base Domain
					</label>
					<Input
						id="domain"
						placeholder="e.g. app.mycompany.com"
						className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
						value={baseDomain}
						onChange={(e) => setBaseDomain(e.target.value)}
					/>
					<span className="text-[10px] text-zinc-500">
						Leave empty to auto-assign a default hostname on localhost caddy ingress router.
					</span>
				</div>
			</div>
		</div>
	);
}
