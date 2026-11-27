import { useQuery } from "@tanstack/react-query";
import { Box, CheckCircle, Container, Globe, Save, Terminal } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import * as api from "../../../api/client";
import { useUpdateProject } from "../../../hooks/useProjects";
import { cn } from "../../../lib/utils";
import type { ImagePullPolicy, Project } from "../../../types";
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
	const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
	const [dockerTarget, setDockerTarget] = useState("");
	const [imageRef, setImageRef] = useState("");
	const [imagePullPolicy, setImagePullPolicy] = useState<ImagePullPolicy>("always");
	const [registryId, setRegistryId] = useState("");
	const [saveSuccess, setSaveSuccess] = useState(false);

	const isImage = project.sourceType === "image";

	const { data: registries = [] } = useQuery({
		queryKey: ["registries"],
		queryFn: () => api.listRegistries().catch(() => []),
		enabled: isImage,
		staleTime: 60_000,
	});

	useEffect(() => {
		if (project) {
			setBuildType(project.buildType || "railpack");
			setBuildCommand(project.buildCommand || "");
			setInstallCommand(project.installCommand || "");
			setOutputDir(project.outputDir || "");
			setStartCommand(project.startCommand || "");
			setDockerfilePath(project.dockerfilePath || "Dockerfile");
			setDockerTarget(project.dockerTarget || "");
			setImageRef(project.imageRef || "");
			setImagePullPolicy(project.imagePullPolicy || "always");
			setRegistryId(project.registryId || "");
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
				dockerfilePath: dockerfilePath.trim() || null,
				dockerTarget: dockerTarget.trim() || null,
				imageRef: isImage ? imageRef.trim() || null : undefined,
				imagePullPolicy: isImage ? imagePullPolicy : undefined,
				registryId: isImage ? registryId || null : undefined,
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
							<h3 className="text-zinc-200 font-bold text-base">
								{isImage ? "Container Image" : "Build & Execution Strategy"}
							</h3>
							<p className="text-zinc-500 text-xs mt-1">
								{isImage
									? "Choose the image to run and how credentials are resolved."
									: "Choose how Dequl compiles and launches your application."}
							</p>
						</div>
						<div className="flex items-center gap-3">
							{saveSuccess && (
								<div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
									<CheckCircle className="h-4 w-4 shrink-0" />
									Saved
								</div>
							)}
							<Button
								type="submit"
								disabled={updateProjectMutation.isPending}
								className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold text-xs h-9 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
							>
								<Save className="h-3.5 w-3.5" />
								{updateProjectMutation.isPending ? "Saving..." : "Save"}
							</Button>
						</div>
					</div>

					{isImage ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-2 sm:col-span-2">
								<label htmlFor="bld-image" className="font-semibold text-xs text-zinc-400">
									Image Reference
								</label>
								<Input
									id="bld-image"
									placeholder="e.g. nginx:alpine or ghcr.io/org/app:v1.2.3"
									className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={imageRef}
									onChange={(e) => setImageRef(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Changing the reference applies on the next deployment.
								</p>
							</div>
							<div className="space-y-2">
								<label htmlFor="bld-pull-policy" className="font-semibold text-xs text-zinc-400">
									Pull Policy
								</label>
								<select
									id="bld-pull-policy"
									value={imagePullPolicy}
									onChange={(e) => setImagePullPolicy(e.target.value as ImagePullPolicy)}
									className="h-9 w-full rounded-lg border border-[#222227] bg-[#141418] px-3 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
								>
									<option value="always">Always pull</option>
									<option value="if-not-present">Pull if not present</option>
									<option value="never">Never pull</option>
								</select>
							</div>
							<div className="space-y-2">
								<label htmlFor="bld-registry" className="font-semibold text-xs text-zinc-400">
									Registry Credentials
								</label>
								<select
									id="bld-registry"
									value={registryId}
									onChange={(e) => setRegistryId(e.target.value)}
									className="h-9 w-full rounded-lg border border-[#222227] bg-[#141418] px-3 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
								>
									<option value="">Public / no credentials</option>
									{registries.map((registry) => (
										<option key={registry.id} value={registry.id}>
											{registry.name} ({registry.url})
										</option>
									))}
								</select>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Manage private registry credentials in Settings.
								</p>
							</div>
						</div>
					) : (
						<>
							<div className="space-y-2.5">
								<span className="font-semibold text-xs text-zinc-400">Build Engine</span>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
											Railpack
										</div>
										<span className="text-[10px] text-zinc-500 leading-relaxed">
											Zero-config builder. Auto-detects runtime, dependencies, and entrypoint.
										</span>
									</button>
									<button
										type="button"
										onClick={() => setBuildType("dockerfile")}
										className={cn(
											"flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all select-none active:scale-[0.98]",
											buildType === "dockerfile"
												? "border-orange-500/30 bg-orange-500/5 text-zinc-200"
												: "border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-400",
										)}
									>
										<div className="flex items-center gap-1.5 font-bold text-xs text-zinc-200">
											<Terminal className="h-4 w-4 text-emerald-400" />
											Dockerfile
										</div>
										<span className="text-[10px] text-zinc-500 leading-relaxed">
											Build from a Dockerfile in your repository with an optional target stage.
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
											<Globe className="h-4 w-4 text-blue-400" />
											Docker Compose
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

							{buildType === "dockerfile" && (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
									<div className="space-y-2">
										<label htmlFor="bld-dockerfile" className="font-semibold text-xs text-zinc-400">
											Dockerfile Path
										</label>
										<Input
											id="bld-dockerfile"
											placeholder="Dockerfile"
											className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
											value={dockerfilePath}
											onChange={(e) => setDockerfilePath(e.target.value)}
										/>
										<p className="text-[10px] text-zinc-500 leading-normal">Relative to the project root directory.</p>
									</div>
									<div className="space-y-2">
										<label htmlFor="bld-docker-target" className="font-semibold text-xs text-zinc-400">
											Build Target
										</label>
										<Input
											id="bld-docker-target"
											placeholder="e.g. runtime (optional)"
											className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
											value={dockerTarget}
											onChange={(e) => setDockerTarget(e.target.value)}
										/>
										<p className="text-[10px] text-zinc-500 leading-normal">
											Multi-stage target to build instead of the final stage.
										</p>
									</div>
								</div>
							)}

							{buildType === "compose" && (
								<div className="flex items-start gap-2.5 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-zinc-300">
									<Container className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
									<p className="text-[11px] leading-relaxed">
										Compose stacks are configured under the Docker Compose section of project settings. Each exposed
										service gets its own route.
									</p>
								</div>
							)}
						</>
					)}
				</form>
			</CardContent>
		</Card>
	);
}
