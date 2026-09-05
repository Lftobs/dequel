import { Box, CheckCircle, Globe, Plus, Save, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useProject, useUpdateProject } from "../../../hooks/useProjects";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";
import { DeleteProjectCard } from "./DeleteProjectCard";

interface ProjectSettingsTabProps {
	projectId: string;
}

export function ProjectSettingsTab({ projectId }: ProjectSettingsTabProps) {
	const { data: project } = useProject(projectId);
	const updateProjectMutation = useUpdateProject();

	const [projectType, setProjectType] = useState("web");
	const [buildType, setBuildType] = useState("railpack");
	const [composeService, setComposeService] = useState("");
	const [composePort, setComposePort] = useState("");
	const [sourceDir, setSourceDir] = useState("");
	const [buildCommand, setBuildCommand] = useState("");
	const [installCommand, setInstallCommand] = useState("");
	const [outputDir, setOutputDir] = useState("");
	const [startCommand, setStartCommand] = useState("");
	const [port, setPort] = useState("");
	const [description, setDescription] = useState("");

	const [saveSuccess, setSaveSuccess] = useState(false);

	const [composeServicesList, setComposeServicesList] = useState<
		{ id: string; serviceName: string; port: string; subdomain: string }[]
	>([{ id: "1", serviceName: "", port: "", subdomain: "" }]);

	useEffect(() => {
		if (project) {
			setProjectType(project.projectType || "web");
			setBuildType((project as any).buildType || "railpack");
			const svc = (project as any).composeService || "";
			const prt = (project as any).composePort ? String((project as any).composePort) : "";
			setComposeService(svc);
			setComposePort(prt);
			setSourceDir(project.sourceDir || "");
			setBuildCommand(project.buildCommand || "");
			setInstallCommand((project as any).installCommand || "");
			setOutputDir((project as any).outputDir || "");
			setStartCommand(project.startCommand || "");
			setPort(project.port ? String(project.port) : "");
			setDescription(project.description || "");

			const rawServices = (project as any).composeServices;
			if (rawServices) {
				try {
					const parsed = typeof rawServices === "string" ? JSON.parse(rawServices) : rawServices;
					if (Array.isArray(parsed) && parsed.length > 0) {
						setComposeServicesList(parsed);
					} else {
						setComposeServicesList([{ id: "1", serviceName: svc, port: prt, subdomain: "" }]);
					}
				} catch (_e) {
					setComposeServicesList([{ id: "1", serviceName: svc, port: prt, subdomain: "" }]);
				}
			} else {
				setComposeServicesList([{ id: "1", serviceName: svc, port: prt, subdomain: "" }]);
			}
		}
	}, [project, projectId]);

	const addComposeServiceRow = () => {
		setComposeServicesList((prev) => [...prev, { id: String(Date.now()), serviceName: "", port: "", subdomain: "" }]);
	};

	const removeComposeServiceRow = (id: string) => {
		if (composeServicesList.length <= 1) return;
		setComposeServicesList((prev) => prev.filter((item) => item.id !== id));
	};

	const updateComposeServiceRow = (id: string, field: "serviceName" | "port" | "subdomain", value: string) => {
		setComposeServicesList((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const primarySvc = composeServicesList[0];
			const finalSvc = primarySvc?.serviceName.trim() || composeService.trim() || null;
			const finalPrt = primarySvc?.port.trim()
				? Number(primarySvc.port) || null
				: composePort.trim()
					? Number(composePort) || null
					: null;

			const payload: any = {
				id: projectId,
				projectType,
				buildType,
				sourceDir: sourceDir.trim() || null,
				buildCommand: buildCommand.trim() || null,
				installCommand: installCommand.trim() || null,
				outputDir: outputDir.trim() || null,
				startCommand: startCommand.trim() || null,
				port: port.trim() ? Number(port) || null : null,
				description: description.trim() || null,
			};

			if (buildType === "compose") {
				payload.composeService = finalSvc;
				payload.composePort = finalPrt;
				payload.composeServices = JSON.stringify(composeServicesList);
			}

			await updateProjectMutation.mutateAsync(payload);

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
									className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
								>
									<Save className="h-3.5 w-3.5" />
									{updateProjectMutation.isPending ? "Saving..." : "Save Settings"}
								</Button>
							</div>
						</div>

						{buildType !== "compose" && (
							<div className="space-y-2.5">
								<label className="font-semibold text-xs text-zinc-400">Project Type</label>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
											Node.js, Elysia, Express, Next.js (SSR), Go, Python dynamic server container.
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

						{/* Build Strategy */}
						<div className="space-y-2.5">
							<label className="font-semibold text-xs text-zinc-400">Build Strategy</label>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
										Build and launch single container app (Node.js, Go, Python, Rust, Astro, etc.).
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
										Build and run multi-service applications using a docker-compose.yml file.
									</span>
								</button>
							</div>
						</div>

						{buildType === "compose" && (
							<div className="p-4 rounded-xl bg-[#141418] border border-[#222227] space-y-4">
								<div className="text-xs font-bold text-zinc-200">Docker Compose Services</div>
								<p className="text-xs text-zinc-400">
									Configure your services and bind subdomains (e.g. Service:{" "}
									<code className="text-orange-400">server</code>, Port: <code className="text-orange-400">3001</code>,
									Subdomain: <code className="text-orange-400">api</code> points{" "}
									<code className="text-orange-400">api.&lt;projectliveurl&gt;</code> to{" "}
									<code className="text-orange-400">server:3001</code>).
								</p>
								<div className="space-y-3">
									{composeServicesList.map((item, index) => (
										<div key={item.id} className="p-3.5 rounded-xl bg-[#0c0c0e] border border-[#222227] space-y-3">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<span className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">
														Service #{index + 1}
													</span>
													{index === 0 && (
														<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase tracking-wider flex items-center gap-1">
															ENTRY
														</span>
													)}
												</div>
												{composeServicesList.length > 1 && index > 0 && (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => removeComposeServiceRow(item.id)}
														className="h-7 text-xs text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 px-2 rounded-lg"
													>
														<Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
													</Button>
												)}
											</div>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
												<div>
													<label className="block text-[11px] font-semibold text-zinc-400 mb-1">Service Name</label>
													<Input
														placeholder="e.g. server or web"
														value={item.serviceName}
														onChange={(e) => updateComposeServiceRow(item.id, "serviceName", e.target.value)}
														className="bg-[#141418] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
													/>
												</div>
												<div>
													<label className="block text-[11px] font-semibold text-zinc-400 mb-1">Service Port</label>
													<Input
														placeholder="e.g. 3001 or 8080"
														type="number"
														value={item.port}
														onChange={(e) => updateComposeServiceRow(item.id, "port", e.target.value)}
														className="bg-[#141418] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
													/>
												</div>
												<div>
													<label className="block text-[11px] font-semibold text-zinc-400 mb-1">
														Preferred Subdomain
													</label>
													{index === 0 ? (
														<div className="flex items-center gap-1.5 h-9 px-3 bg-[#141418]/80 border border-[#222227] rounded-lg text-xs text-zinc-400 font-mono">
															<span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold">
																ENTRY
															</span>
															<span className="text-zinc-500 text-[11px]">Primary Project Domain</span>
														</div>
													) : (
														<Input
															placeholder="e.g. api"
															value={item.subdomain}
															onChange={(e) => updateComposeServiceRow(item.id, "subdomain", e.target.value)}
															className="bg-[#141418] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
														/>
													)}
												</div>
											</div>
										</div>
									))}

									<Button
										type="button"
										onClick={addComposeServiceRow}
										variant="outline"
										className="w-full bg-[#0c0c0e] border-dashed border-[#222227] hover:border-orange-500/50 text-xs text-zinc-400 hover:text-zinc-200 font-semibold flex items-center justify-center gap-1.5 h-9 rounded-xl transition-all"
									>
										<Plus className="h-3.5 w-3.5 text-orange-500" /> Add Another Service Mapping
									</Button>
								</div>
							</div>
						)}

						<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

							<div className="space-y-2">
								<label htmlFor="installCommand" className="font-semibold text-xs text-zinc-400">
									Install Command
								</label>
								<Input
									id="installCommand"
									placeholder="e.g. pnpm install --no-frozen-lockfile"
									className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={installCommand}
									onChange={(e) => setInstallCommand(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Override the dependency installation command. Leave blank for auto.
								</p>
							</div>

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

							<div className="space-y-2">
								<label htmlFor="outputDir" className="font-semibold text-xs text-zinc-400">
									Output Directory
								</label>
								<Input
									id="outputDir"
									placeholder="e.g. dist, build, out, or .next (leave empty for auto)"
									className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
									value={outputDir}
									onChange={(e) => setOutputDir(e.target.value)}
								/>
								<p className="text-[10px] text-zinc-500 leading-normal">
									Directory where compiled static assets are located (for Static Site deployments).
								</p>
							</div>

							<div className="space-y-2 md:col-span-2">
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

			<DeleteProjectCard projectId={projectId} />
		</div>
	);
}
