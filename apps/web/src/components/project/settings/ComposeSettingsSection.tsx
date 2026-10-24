import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Layers, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client";
import type { Project } from "../../../types";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";

interface ComposeServiceRow {
	id: string;
	serviceName: string;
	port: string;
	subdomain: string;
}

interface ComposeSettingsSectionProps {
	project: Project;
}

export function ComposeSettingsSection({ project }: ComposeSettingsSectionProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const { data, isLoading, error } = useQuery({
		queryKey: ["project-compose", project.id],
		queryFn: () => api.getProjectCompose(project.id),
	});

	const [composeCode, setComposeCode] = useState("");
	const [primaryService, setPrimaryService] = useState("");
	const [primaryPort, setPrimaryPort] = useState("");
	const [servicesList, setServicesList] = useState<ComposeServiceRow[]>([]);
	const [parseError, setParseError] = useState<string | null>(null);
	const [detectedServices, setDetectedServices] = useState<string[]>([]);
	const [saveSuccess, setSaveSuccess] = useState(false);

	const initializedFor = useRef<string | null>(null);
	useEffect(() => {
		if (data && initializedFor.current !== project.id) {
			initializedFor.current = project.id;
			setComposeCode(data.compose || "");
			setPrimaryService(data.composeService || (project as any).composeService || "");
			setPrimaryPort(
				data.composePort
					? String(data.composePort)
					: (project as any).composePort
						? String((project as any).composePort)
						: "",
			);

			const rawServices = data.composeServices ?? (project as any).composeServices;
			if (rawServices) {
				try {
					const parsed = typeof rawServices === "string" ? JSON.parse(rawServices) : rawServices;
					if (Array.isArray(parsed) && parsed.length > 0) {
						setServicesList(parsed);
						return;
					}
				} catch {}
			}
			setServicesList([
				{
					id: "1",
					serviceName: data.composeService || (project as any).composeService || "",
					port: data.composePort ? String(data.composePort) : "",
					subdomain: "",
				},
			]);
		}
	}, [data, project]);

	useEffect(() => {
		if (!composeCode) return;
		try {
			const lines = composeCode.split("\n");
			let inServices = false;
			const found: string[] = [];
			for (const line of lines) {
				const trimmed = line.trimEnd();
				if (/^services:\s*$/.test(trimmed)) {
					inServices = true;
					continue;
				}
				if (inServices) {
					if (/^[a-zA-Z0-9_-]+:\s*$/.test(trimmed)) {
						inServices = false;
						continue;
					}
					const match = trimmed.match(/^ {2}([a-zA-Z0-9_-]+):\s*$/);
					if (match?.[1]) {
						found.push(match[1]);
					}
				}
			}
			setDetectedServices(found);
			setParseError(null);
		} catch (err) {
			setParseError(err instanceof Error ? err.message : "Error parsing compose");
		}
	}, [composeCode]);

	const updateMutation = useMutation({
		mutationFn: (payload: {
			compose: string;
			composeService?: string;
			composePort?: number;
			composeServices?: any[];
		}) => api.updateProjectCompose(project.id, payload),
		onSuccess: (res) => {
			setSaveSuccess(true);
			queryClient.invalidateQueries({ queryKey: ["project-compose", project.id] });
			queryClient.invalidateQueries({ queryKey: ["project", project.id] });
			queryClient.invalidateQueries({ queryKey: ["deployments", project.id] });
			setTimeout(() => setSaveSuccess(false), 3000);

			if (res?.deployment?.id) {
				navigate({
					to: "/project/$projectId/deployments/$deploymentId",
					params: { projectId: project.id, deploymentId: res.deployment.id },
				});
			}
		},
	});

	const handleSave = () => {
		const targetService = primaryService.trim() || detectedServices[0] || undefined;
		const targetPort = primaryPort.trim() ? Number(primaryPort) : undefined;
		updateMutation.mutate({
			compose: composeCode,
			composeService: targetService,
			composePort: targetPort,
			composeServices: servicesList,
		});
	};

	const addRow = () => {
		setServicesList((prev) => [...prev, { id: String(Date.now()), serviceName: "", port: "", subdomain: "" }]);
	};

	const removeRow = (id: string) => {
		if (servicesList.length <= 1) return;
		setServicesList((prev) => prev.filter((r) => r.id !== id));
	};

	const updateRow = (id: string, field: keyof ComposeServiceRow, val: string) => {
		setServicesList((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
	};

	if (isLoading) {
		return (
			<Card className="bg-[#0c0c0e]/60 border-[#222227] rounded-xl p-8 text-center text-xs text-zinc-500">
				Loading compose stack configuration...
			</Card>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-300">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>Failed to load Docker Compose configuration</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			<Card className="bg-[#0c0c0e]/60 border-[#222227] rounded-xl overflow-hidden">
				<CardHeader className="p-6 pb-4 border-b border-[#222227]">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<CardTitle className="text-base text-zinc-200 flex items-center gap-2">
								<Layers className="h-4 w-4 text-orange-500" /> Docker Compose Stack
							</CardTitle>
							<CardDescription className="text-xs text-zinc-400 mt-1">
								View and modify your stack definition. Saving will bundle the compose file and trigger a redeploy.
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setComposeCode(data?.compose || "")}
								className="h-8 text-xs border-[#222227] bg-[#141418] hover:bg-[#1a1a20] text-zinc-300"
							>
								<RefreshCw className="h-3.5 w-3.5 mr-1" /> Revert
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={updateMutation.isPending || !!parseError}
								onClick={handleSave}
								className="h-8 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
							>
								<Play className="h-3.5 w-3.5" />
								{updateMutation.isPending ? "Deploying..." : "Save & Redeploy"}
							</Button>
						</div>
					</div>

					{updateMutation.error && (
						<Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-300">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription className="text-xs">
								{updateMutation.error instanceof Error
									? updateMutation.error.message
									: "Failed to save and redeploy compose"}
							</AlertDescription>
						</Alert>
					)}

					{detectedServices.length > 0 && (
						<div className="flex items-center gap-2 pt-3 flex-wrap">
							<span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
								Detected Services:
							</span>
							{detectedServices.map((svc) => (
								<Badge
									key={svc}
									variant="secondary"
									className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[11px] font-mono px-2 py-0.5"
								>
									{svc}
								</Badge>
							))}
						</div>
					)}
				</CardHeader>

				<CardContent className="p-6 space-y-4">
					{saveSuccess && (
						<Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
							<CheckCircle2 className="h-4 w-4 text-emerald-400" />
							<AlertDescription>Compose configuration updated and deployment queued!</AlertDescription>
						</Alert>
					)}

					{parseError && (
						<Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-300">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription className="font-mono text-xs">{parseError}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<label htmlFor="compose-editor" className="text-xs font-bold text-zinc-300">
								docker-compose.yml
							</label>
							<span className="text-[11px] text-zinc-500 font-mono">YAML syntax</span>
						</div>
						<textarea
							id="compose-editor"
							rows={18}
							value={composeCode}
							onChange={(e) => setComposeCode(e.target.value)}
							className="w-full font-mono text-xs p-3.5 bg-[#08080a] text-zinc-200 border border-[#222227] rounded-xl focus:outline-none focus:border-orange-500/50 resize-y leading-relaxed"
							placeholder="version: '3.8'&#10;&#10;services:&#10;  web:&#10;    image: node:20-alpine&#10;    ports:&#10;      - '3000:3000'"
						/>
					</div>
				</CardContent>
			</Card>

			<Card className="bg-[#0c0c0e]/60 border-[#222227] rounded-xl overflow-hidden">
				<CardHeader className="p-6 pb-4 border-b border-[#222227]">
					<CardTitle className="text-base text-zinc-200">Ingress & Service Routing</CardTitle>
					<CardDescription className="text-xs text-zinc-400">
						Map exposed services to public URLs. Entry service receives primary domain traffic; additional services
						receive subdomain routes.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-6 space-y-4">
					<div className="space-y-3">
						{servicesList.map((item, index) => (
							<div key={item.id} className="p-3.5 rounded-xl bg-[#141418] border border-[#222227] space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">
											Service #{index + 1}
										</span>
										{index === 0 && (
											<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase tracking-wider">
												ENTRY
											</span>
										)}
									</div>
									{servicesList.length > 1 && index > 0 && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => removeRow(item.id)}
											className="h-7 text-xs text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 px-2 rounded-lg"
										>
											<Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
										</Button>
									)}
								</div>

								<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
									<div>
										<label
											htmlFor={`compose-service-${item.id}`}
											className="block text-[11px] font-semibold text-zinc-400 mb-1"
										>
											Service Name
										</label>
										<Input
											id={`compose-service-${item.id}`}
											placeholder="e.g. web or app"
											value={item.serviceName}
											onChange={(e) => updateRow(item.id, "serviceName", e.target.value)}
											className="bg-[#0c0c0e] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
										/>
									</div>
									<div>
										<label
											htmlFor={`compose-port-${item.id}`}
											className="block text-[11px] font-semibold text-zinc-400 mb-1"
										>
											Internal Port
										</label>
										<Input
											id={`compose-port-${item.id}`}
											placeholder="e.g. 80 or 3000"
											type="number"
											value={item.port}
											onChange={(e) => updateRow(item.id, "port", e.target.value)}
											className="bg-[#0c0c0e] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
										/>
									</div>
									<div>
										<label
											htmlFor={`compose-subdomain-${item.id}`}
											className="block text-[11px] font-semibold text-zinc-400 mb-1"
										>
											Routing Target
										</label>
										{index === 0 ? (
											<div className="flex items-center gap-1.5 h-9 px-3 bg-[#0c0c0e] border border-[#222227] rounded-lg text-xs text-zinc-400 font-mono">
												<span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold">
													ROOT
												</span>
												<span className="text-zinc-500 text-[11px]">Primary Domain Ingress</span>
											</div>
										) : (
											<Input
												id={`compose-subdomain-${item.id}`}
												placeholder="e.g. api (subdomain)"
												value={item.subdomain}
												onChange={(e) => updateRow(item.id, "subdomain", e.target.value)}
												className="bg-[#0c0c0e] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
											/>
										)}
									</div>
								</div>
							</div>
						))}

						<Button
							type="button"
							onClick={addRow}
							variant="outline"
							className="w-full bg-[#141418] border-dashed border-[#222227] hover:border-orange-500/50 text-xs text-zinc-400 hover:text-zinc-200 font-semibold flex items-center justify-center gap-1.5 h-9 rounded-xl transition-all"
						>
							<Plus className="h-3.5 w-3.5 text-orange-500" /> Add Another Service Route
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
