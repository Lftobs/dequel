import React, { useState, useEffect } from "react";
import { useProject, useUpdateProject } from "../../../hooks/useProjects";
import { Card, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Box, Globe, Save, CheckCircle } from "lucide-react";
import { cn } from "../../../lib/utils";

interface ProjectSettingsTabProps {
	projectId: string;
}

export function ProjectSettingsTab({ projectId }: ProjectSettingsTabProps) {
	const { data: project } = useProject(projectId);
	const updateProjectMutation = useUpdateProject();

	const [projectType, setProjectType] = useState("web");
	const [sourceDir, setSourceDir] = useState("");
	const [buildCommand, setBuildCommand] = useState("");
	const [startCommand, setStartCommand] = useState("");
	const [port, setPort] = useState("");
	const [description, setDescription] = useState("");

	const [saveSuccess, setSaveSuccess] = useState(false);

	useEffect(() => {
		if (project) {
			setProjectType(project.projectType || "web");
			setSourceDir(project.sourceDir || "");
			setBuildCommand(project.buildCommand || "");
			setStartCommand(project.startCommand || "");
			setPort(project.port ? String(project.port) : "");
			setDescription(project.description || "");
		}
	}, [project]);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await updateProjectMutation.mutateAsync({
				id: projectId,
				projectType,
				sourceDir: sourceDir.trim() || null,
				buildCommand: buildCommand.trim() || null,
				startCommand: startCommand.trim() || null,
				port: port.trim() ? Number(port) || null : null,
				description: description.trim() || null,
			} as any);

			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err) {
			console.error("Failed to update project settings:", err);
		}
	};

	if (!project) return null;

	return (
		<div className="space-y-6">
			<Card className="bg-[#0c0c0e]/60 border-[#222227] rounded-xl overflow-hidden">
				<CardContent className="p-6">
					<form onSubmit={handleSave} className="space-y-6">
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#222227] pb-5">
							<div>
								<h3 className="text-zinc-200 font-bold text-base">Build & Execution Settings</h3>
								<p className="text-zinc-500 text-xs mt-1">
									Configure how Dequel resolves, builds, and launches your codebase.
								</p>
							</div>
							<div className="flex items-center gap-3">
								{saveSuccess && (
									<div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
										<CheckCircle className="h-4 w-4" />
										Settings saved successfully
									</div>
								)}
								<Button
									type="submit"
									disabled={updateProjectMutation.isPending}
									className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-black font-semibold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
								>
									<Save className="h-3.5 w-3.5" />
									{updateProjectMutation.isPending ? "Saving..." : "Save Settings"}
								</Button>
							</div>
						</div>

						{/* Project Type */}
						<div className="space-y-2.5">
							<label className="font-semibold text-xs text-zinc-400">
								Project Type
							</label>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<button
									type="button"
									onClick={() => setProjectType("web")}
									className={cn(
										"flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all select-none active:scale-[0.98]",
										projectType === "web"
											? "border-amber-500/30 bg-amber-500/5 text-zinc-200"
											: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400"
									)}
								>
									<div className="flex items-center gap-1.5 font-bold text-xs text-zinc-250">
										<Box className="h-4 w-4 text-amber-500" />
										Web Application
									</div>
									<span className="text-[10px] text-zinc-500 leading-relaxed">
										Build and launch standard persistent backend engines or databases (Node.js, Rust, Go, Python, APIs).
									</span>
								</button>
								<button
									type="button"
									onClick={() => setProjectType("static")}
									className={cn(
										"flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all select-none active:scale-[0.98]",
										projectType === "static"
											? "border-amber-500/30 bg-amber-500/5 text-zinc-200"
											: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400"
									)}
								>
									<div className="flex items-center gap-1.5 font-bold text-xs text-zinc-250">
										<Globe className="h-4 w-4 text-amber-500" />
										Static Site
									</div>
									<span className="text-[10px] text-zinc-500 leading-relaxed">
										Generate static client bundles (Vite, Astro, Vue) served automatically by Dequel's SPA static web server.
									</span>
								</button>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
							{/* Root Directory / Source Dir */}
							<div className="space-y-2">
								<label htmlFor="sourceDir" className="font-semibold text-xs text-zinc-400">
									Root Directory
								</label>
								<Input
									id="sourceDir"
									placeholder="e.g. apps/web (leave empty for repo root)"
									className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs h-9 rounded-lg"
									value={sourceDir}
									onChange={(e) => setSourceDir(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Path inside your repository where build operations should run.
								</p>
							</div>

							{/* Internal Port */}
							<div className="space-y-2">
								<label htmlFor="port" className="font-semibold text-xs text-zinc-400">
									Port
								</label>
								<Input
									id="port"
									type="number"
									placeholder="e.g. 3000"
									className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs h-9 rounded-lg"
									value={port}
									onChange={(e) => setPort(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									The internal port number your application container listens on.
								</p>
							</div>

							{/* Build Command Override */}
							<div className="space-y-2">
								<label htmlFor="buildCommand" className="font-semibold text-xs text-zinc-400">
									Build Command
								</label>
								<Input
									id="buildCommand"
									placeholder="e.g. npm run build (leave empty for auto)"
									className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={buildCommand}
									onChange={(e) => setBuildCommand(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Override the build command execution. Leave blank to let Dequel auto-detect it.
								</p>
							</div>

							{/* Start Command Override */}
							<div className="space-y-2">
								<label htmlFor="startCommand" className="font-semibold text-xs text-zinc-400">
									Start Command
								</label>
								<Input
									id="startCommand"
									placeholder="e.g. node dist/index.js (leave empty for auto)"
									className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={startCommand}
									onChange={(e) => setStartCommand(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Override the launch start command. Leave blank to let Dequel auto-detect it.
								</p>
							</div>

							{/* Description */}
							<div className="space-y-2 md:col-span-2">
								<label htmlFor="description" className="font-semibold text-xs text-zinc-400">
									Project Description
								</label>
								<Input
									id="description"
									placeholder="Describe this service..."
									className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs h-9 rounded-lg"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
								/>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
