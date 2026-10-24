import { Box, CheckCircle, Globe, Save } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useUpdateProject } from "../../../hooks/useProjects";
import { cn } from "../../../lib/utils";
import type { Project } from "../../../types";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";

interface BuildSettingsSectionProps {
	project: Project;
}

export function BuildSettingsSection({ project }: BuildSettingsSectionProps) {
	const updateProjectMutation = useUpdateProject();

	const [buildType, setBuildType] = useState("railpack");
	const [buildCommand, setBuildCommand] = useState("");
	const [installCommand, setInstallCommand] = useState("");
	const [outputDir, setOutputDir] = useState("");
	const [startCommand, setStartCommand] = useState("");
	const [saveSuccess, setSaveSuccess] = useState(false);

	useEffect(() => {
		if (project) {
			setBuildType((project as any).buildType || "railpack");
			setBuildCommand(project.buildCommand || "");
			setInstallCommand((project as any).installCommand || "");
			setOutputDir((project as any).outputDir || "");
			setStartCommand(project.startCommand || "");
		}
	}, [project]);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await updateProjectMutation.mutateAsync({
				id: project.id,
				buildType,
				buildCommand: buildCommand.trim() || null,
				installCommand: installCommand.trim() || null,
				outputDir: outputDir.trim() || null,
				startCommand: startCommand.trim() || null,
			});
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err) {
			console.error("Failed to update build settings:", err);
		}
	};

	return (
		<Card className="bg-[#0c0c0e]/60 border-[#222227] rounded-xl overflow-hidden">
			<CardContent className="p-6">
				<form onSubmit={handleSave} className="space-y-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#222227]">
						<div>
							<h3 className="text-zinc-200 font-bold text-base">Build & Execution Strategy</h3>
							<p className="text-zinc-500 text-xs mt-1">Choose how Dequel compiles and launches your application.</p>
						</div>
						<div className="flex items-center gap-3">
							{saveSuccess && (
								<div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
									<CheckCircle className="h-4 w-4 shrink-0" />
									Strategy saved
								</div>
							)}
							<Button
								type="submit"
								disabled={updateProjectMutation.isPending}
								className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold text-xs h-9 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
							>
								<Save className="h-3.5 w-3.5" />
								{updateProjectMutation.isPending ? "Saving..." : "Save Strategy"}
							</Button>
						</div>
					</div>

					<div className="space-y-2.5">
						<span className="font-semibold text-xs text-zinc-400">Build Engine</span>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<button
								type="button"
								onClick={() => setBuildType("railpack")}
								className={cn(
									"flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all select-none active:scale-[0.98]",
									buildType === "railpack"
										? "border-orange-500/30 bg-orange-500/5 text-zinc-200"
										: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400",
								)}
							>
								<div className="flex items-center gap-1.5 font-bold text-xs text-zinc-200">
									<Box className="h-4 w-4 text-orange-500" />
									Railpack Auto-Detection
								</div>
								<span className="text-[10px] text-zinc-500 leading-relaxed">
									Zero-config container builder. Auto-detects runtime, dependencies, and entrypoint.
								</span>
							</button>
							<button
								type="button"
								onClick={() => setBuildType("compose")}
								className={cn(
									"flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all select-none active:scale-[0.98]",
									buildType === "compose"
										? "border-orange-500/30 bg-orange-500/5 text-zinc-200"
										: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400",
								)}
							>
								<div className="flex items-center gap-1.5 font-bold text-xs text-zinc-200">
									<Globe className="h-4 w-4 text-orange-500" />
									Docker Compose Stack
								</div>
								<span className="text-[10px] text-zinc-500 leading-relaxed">
									Multi-container stacks configured via a docker-compose.yml file.
								</span>
							</button>
						</div>
					</div>

					{buildType === "railpack" && (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
							<div className="space-y-2">
								<label htmlFor="bld-install" className="font-semibold text-xs text-zinc-400">
									Install Command
								</label>
								<Input
									id="bld-install"
									placeholder="e.g. pnpm install --no-frozen-lockfile"
									className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={installCommand}
									onChange={(e) => setInstallCommand(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Override dependency installation. Leave blank for auto-detection.
								</p>
							</div>

							<div className="space-y-2">
								<label htmlFor="bld-build" className="font-semibold text-xs text-zinc-400">
									Build Command
								</label>
								<Input
									id="bld-build"
									placeholder="e.g. npm run build"
									className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={buildCommand}
									onChange={(e) => setBuildCommand(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Override build command. Leave blank for auto-detection.
								</p>
							</div>

							<div className="space-y-2">
								<label htmlFor="bld-output" className="font-semibold text-xs text-zinc-400">
									Output Directory
								</label>
								<Input
									id="bld-output"
									placeholder="e.g. dist, build, or .next"
									className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={outputDir}
									onChange={(e) => setOutputDir(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Directory containing compiled static assets (for Static Site projects).
								</p>
							</div>

							<div className="space-y-2">
								<label htmlFor="bld-start" className="font-semibold text-xs text-zinc-400">
									Start Command
								</label>
								<Input
									id="bld-start"
									placeholder="e.g. node dist/index.js"
									className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={startCommand}
									onChange={(e) => setStartCommand(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Override application launch command. Leave blank for auto-detection.
								</p>
							</div>
						</div>
					)}
				</form>
			</CardContent>
		</Card>
	);
}
