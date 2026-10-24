import { Box, CheckCircle, Globe, Save } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useUpdateProject } from "../../../hooks/useProjects";
import { cn } from "../../../lib/utils";
import type { Project } from "../../../types";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";

interface GeneralSettingsSectionProps {
	project: Project;
}

export function GeneralSettingsSection({ project }: GeneralSettingsSectionProps) {
	const updateProjectMutation = useUpdateProject();

	const [description, setDescription] = useState("");
	const [projectType, setProjectType] = useState("web");
	const [sourceDir, setSourceDir] = useState("");
	const [port, setPort] = useState("");
	const [saveSuccess, setSaveSuccess] = useState(false);

	useEffect(() => {
		if (project) {
			setDescription(project.description || "");
			setProjectType(project.projectType || "web");
			setSourceDir(project.sourceDir || "");
			setPort(project.port ? String(project.port) : "");
		}
	}, [project]);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await updateProjectMutation.mutateAsync({
				id: project.id,
				description: description.trim() || null,
				projectType,
				sourceDir: sourceDir.trim() || null,
				port: port.trim() ? Number(port) || null : null,
			});
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err) {
			console.error("Failed to update general settings:", err);
		}
	};

	const isCompose = project.buildType === "compose" || !!(project as any).composeService;

	return (
		<Card className="bg-[#0c0c0e]/60 border-[#222227] rounded-xl overflow-hidden">
			<CardContent className="p-6">
				<form onSubmit={handleSave} className="space-y-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#222227]">
						<div>
							<h3 className="text-zinc-200 font-bold text-base">General Settings</h3>
							<p className="text-zinc-500 text-xs mt-1">
								Project metadata, directory layout, and default service behavior.
							</p>
						</div>
						<div className="flex items-center gap-3">
							{saveSuccess && (
								<div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
									<CheckCircle className="h-4 w-4 shrink-0" />
									Settings saved
								</div>
							)}
							<Button
								type="submit"
								disabled={updateProjectMutation.isPending}
								className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold text-xs h-9 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
							>
								<Save className="h-3.5 w-3.5" />
								{updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</div>

					<div className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="gen-description" className="font-semibold text-xs text-zinc-400">
								Project Description
							</label>
							<Input
								id="gen-description"
								placeholder="Describe what this service does..."
								className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>

						{!isCompose && (
							<div className="space-y-2.5">
								<span className="font-semibold text-xs text-zinc-400">Project Type</span>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<button
										type="button"
										onClick={() => setProjectType("web")}
										aria-pressed={projectType === "web"}
										className={cn(
											"flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all select-none active:scale-[0.98]",
											projectType === "web"
												? "border-orange-500/30 bg-orange-500/5 text-zinc-200"
												: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400",
										)}
									>
										<div className="flex items-center gap-1.5 font-bold text-xs text-zinc-200">
											<Globe className="h-4 w-4 text-orange-500" />
											Web Service
										</div>
										<span className="text-[10px] text-zinc-500 leading-relaxed">
											Node.js, Elysia, Express, Next.js, Go, Python container application.
										</span>
									</button>
									<button
										type="button"
										onClick={() => setProjectType("static")}
										aria-pressed={projectType === "static"}
										className={cn(
											"flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all select-none active:scale-[0.98]",
											projectType === "static"
												? "border-emerald-500/30 bg-emerald-500/5 text-zinc-200"
												: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400",
										)}
									>
										<div className="flex items-center gap-1.5 font-bold text-xs text-zinc-200">
											<Box className="h-4 w-4 text-emerald-500" />
											Static Site / SPA
										</div>
										<span className="text-[10px] text-zinc-500 leading-relaxed">
											React, Vite, Astro, HTML static export served via lightweight HTTP file server.
										</span>
									</button>
								</div>
							</div>
						)}

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-2">
								<label htmlFor="gen-sourceDir" className="font-semibold text-xs text-zinc-400">
									Root Directory
								</label>
								<Input
									id="gen-sourceDir"
									placeholder="e.g. apps/web (leave empty for repo root)"
									className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg"
									value={sourceDir}
									onChange={(e) => setSourceDir(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Path inside your repository where build operations should run.
								</p>
							</div>

							<div className="space-y-2">
								<label htmlFor="gen-port" className="font-semibold text-xs text-zinc-400">
									Target Port
								</label>
								<Input
									id="gen-port"
									type="number"
									placeholder={isCompose ? "Managed via Compose" : "e.g. 3000"}
									disabled={isCompose}
									className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg disabled:opacity-50"
									value={port}
									onChange={(e) => setPort(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									{isCompose
										? "Ports are configured per service under the Docker Compose section."
										: "The internal port number your application container listens on."}
								</p>
							</div>
						</div>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
