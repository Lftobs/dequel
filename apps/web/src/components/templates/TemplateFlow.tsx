import { useQuery } from "@tanstack/react-query";
import { Laptop, LayoutTemplate, Rocket, Server, X } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/client";
import type { DeployTemplateMeta, Server as DequelServer } from "../../types";
import { getDeploymentTargets } from "../project/create/DeploymentTargetSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { templateLogo } from "./logos";

interface TemplateFlowProps {
	onDeployed: (projectId: string) => void;
	wide?: boolean;
	showHeading?: boolean;
}

const resourceHint = (s: DequelServer): string | null => {
	if (!s.memoryTotalMb || s.memoryUsedMb == null) return null;
	const freeGb = ((s.memoryTotalMb - s.memoryUsedMb) / 1024).toFixed(1);
	const totalGb = (s.memoryTotalMb / 1024).toFixed(0);
	const cpu = s.cpuUsedPercent != null ? ` - ${Math.round(s.cpuUsedPercent)}% CPU` : "";
	return `${freeGb}/${totalGb} GB RAM free${cpu}`;
};

const TemplateIcon = ({ templateKey, name, className }: { templateKey: string; name: string; className: string }) => {
	const logo = templateLogo(templateKey);
	if (logo) {
		return (
			<svg viewBox="0 0 24 24" aria-hidden className={`${className} shrink-0`}>
				<path d={logo.path} fill={logo.hex} fillRule="evenodd" />
			</svg>
		);
	}
	return (
		<span
			aria-hidden
			className={`${className} shrink-0 grid place-items-center rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-black text-zinc-300`}
		>
			{name.slice(0, 1).toUpperCase()}
		</span>
	);
};

export function TemplateFlow({ onDeployed, wide = false, showHeading = true }: TemplateFlowProps) {
	const { data: templates = [], isLoading } = useQuery({
		queryKey: ["templates"],
		queryFn: () => api.listTemplates().catch(() => [] as DeployTemplateMeta[]),
	});
	const { data: servers = [] } = useQuery({
		queryKey: ["servers"],
		queryFn: () => api.listServers().catch(() => [] as DequelServer[]),
	});
	const serverTargets = getDeploymentTargets(servers).filter((s) => s.mode === "local");
	const [selected, setSelected] = useState<DeployTemplateMeta | null>(null);
	const [name, setName] = useState("");
	const [serverId, setServerId] = useState("auto");
	const [values, setValues] = useState<Record<string, string>>({});
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const selectTemplate = (template: DeployTemplateMeta) => {
		setSelected(template);
		setName(template.name.toLowerCase());
		setValues(
			Object.fromEntries(template.vars.filter((v) => !v.secret && v.default).map((v) => [v.key, v.default as string])),
		);
		setError("");
	};

	const clearSelection = () => {
		setSelected(null);
		setError("");
	};

	const updateTemplate = (key: string, value: string) => {
		if (!selected) return;
		setValues((prev) => ({ ...prev, [key]: value }));
		if (error) setError("");
	};

	const updateName = (value: string) => {
		setName(value);
		if (error) setError("");
	};

	const handleSubmit = async () => {
		if (!selected) return;
		if (!name.trim()) {
			setError("Please enter a project name.");
			return;
		}
		setSubmitting(true);
		setError("");
		try {
			const result = await api.deployTemplate(selected.key, {
				name: name.trim(),
				values,
				serverId: serverId === "auto" ? undefined : serverId,
			});
			setSelected(null);
			onDeployed(result.project.id);
		} catch (err) {
			setSubmitting(false);
			setError(err instanceof Error && err.message ? err.message : "Failed to deploy template.");
		}
	};

	return (
		<div className="bg-[#0c0c0e] border border-[#1c1c21] rounded-2xl p-5 sm:p-6 space-y-4 min-w-0">
			{selected ? (
				<div className="space-y-5">
					<button
						type="button"
						onClick={clearSelection}
						className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
						disabled={submitting}
					>
						<X className="h-4 w-4" />
						Cancel template
					</button>

					<div className="space-y-2 min-w-0">
						<div className="flex items-center justify-between gap-3 flex-wrap">
							<div className="flex items-center gap-2.5 min-w-0">
								<TemplateIcon templateKey={selected.key} name={selected.name} className="h-7 w-7" />
								<h3 className="text-lg font-bold text-white truncate">{selected.name}</h3>
							</div>
							<div className="flex items-center gap-2 flex-wrap">
								<span className="text-[10px] uppercase tracking-wider text-amber-400/90 border border-amber-500/20 rounded-md px-1.5 py-0.5">
									{selected.category}
								</span>
								<span className="text-[11px] font-mono text-zinc-500">
									{selected.service}:{selected.port}
								</span>
								{selected.docsUrl && (
									<a
										href={selected.docsUrl}
										target="_blank"
										rel="noreferrer"
										className="text-[11px] text-zinc-400 hover:text-orange-400 transition-colors"
									>
										Docs
									</a>
								)}
							</div>
						</div>
						<p className="text-xs text-zinc-400">{selected.description}</p>
					</div>

					<div className="space-y-2">
						<label htmlFor="template-name" className="block text-xs font-bold text-zinc-200">
							Project name
						</label>
						<input
							id="template-name"
							type="text"
							value={name}
							onChange={(e) => updateName(e.target.value)}
							placeholder="my-n8n"
							autoComplete="off"
							className="w-full bg-[#121215] border border-[#26262e] rounded-xl px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
						/>
						<p className="text-[11px] text-zinc-500">
							The deployment URL is derived from this name, e.g. {name || "name"}.your-domain.com.
						</p>
					</div>

					<div className="space-y-2">
						<label htmlFor="template-server" className="block text-xs font-bold text-zinc-200">
							Deployment server
						</label>
						{serverTargets.length > 0 ? (
							<Select value={serverId} onValueChange={setServerId}>
								<SelectTrigger
									id="template-server"
									className="bg-[#121215] border-[#26262e] rounded-xl h-10 text-sm text-zinc-100 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
								>
									<SelectValue placeholder="Select a server" />
								</SelectTrigger>
								<SelectContent className="bg-[#141418] border-[#222227] text-zinc-200">
									<SelectItem value="auto">
										<span className="flex items-center gap-2">
											<Rocket className="h-3.5 w-3.5 text-orange-500" />
											<span className="font-medium">Auto</span>
											<span className="text-zinc-500 text-xs">- picks the server with the most free resources</span>
										</span>
									</SelectItem>
									{serverTargets.map((s) => (
										<SelectItem key={s.id} value={s.id}>
											<span className="flex items-center gap-2">
												{s.mode === "local" ? (
													<Laptop className="h-3.5 w-3.5 text-amber-500" />
												) : (
													<Server className="h-3.5 w-3.5 text-emerald-500" />
												)}
												<span className="font-medium">{s.mode === "local" ? "This Machine" : s.name}</span>
												<span className="text-[10px] text-zinc-500">{resourceHint(s) ?? s.host}</span>
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<div className="h-10 rounded-xl border border-dashed border-[#26262e] flex items-center px-3 text-xs text-zinc-500">
								No servers available - deploying on the local machine.
							</div>
						)}
					</div>

					{selected.vars.length > 0 && (
						<div className="space-y-4">
							<div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Template settings</div>
							{selected.vars.map((variant) => (
								<div key={variant.key} className="space-y-1.5">
									<label
										htmlFor={`template-var-${variant.key}`}
										className="flex items-center gap-2 text-xs font-bold text-zinc-200"
									>
										{variant.label}
										<span className="font-mono text-[10px] text-zinc-500">{variant.key}</span>
									</label>
									<input
										id={`template-var-${variant.key}`}
										type="text"
										value={values[variant.key] ?? ""}
										onChange={(e) => updateTemplate(variant.key, e.target.value)}
										placeholder={variant.secret ? "Leave empty to auto-generate" : (variant.default ?? "")}
										autoComplete="off"
										className="w-full bg-[#121215] border border-[#26262e] rounded-xl px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
									/>
									{variant.description && <p className="text-[11px] text-zinc-500">{variant.description}</p>}
								</div>
							))}
						</div>
					)}

					{error && (
						<div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{error}</div>
					)}

					<button
						type="button"
						onClick={handleSubmit}
						disabled={submitting || !name.trim()}
						className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold h-11 text-xs rounded-xl shadow-lg shadow-orange-500/20 inline-flex items-center justify-center gap-2 transition-opacity"
					>
						<Rocket className="h-4 w-4" />
						{submitting ? "Deploying..." : "Deploy Template"}
					</button>
				</div>
			) : (
				<>
					{showHeading && (
						<div className="flex items-center gap-2">
							<LayoutTemplate className="h-4 w-4 text-orange-500" />
							<div>
								<h3 className="text-sm font-bold text-white">Deploy from a template</h3>
								<p className="text-xs text-zinc-500">One-click deployments for popular self-hosted apps.</p>
							</div>
						</div>
					)}
					{isLoading ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
							{[1, 2, 3].map((n) => (
								<div key={n} className="h-[100px] rounded-xl bg-[#121215] border border-[#1c1c21] animate-pulse" />
							))}
						</div>
					) : (
						<div className={`grid grid-cols-1 sm:grid-cols-2 ${wide ? "xl:grid-cols-4" : "xl:grid-cols-3"} gap-3`}>
							{templates.map((template) => (
								<button
									type="button"
									key={template.key}
									onClick={() => selectTemplate(template)}
									className="text-left rounded-xl border border-[#1c1c21] bg-[#121215] p-3.5 hover:border-orange-500/50 hover:bg-[#16161a] transition-colors space-y-2 min-w-0 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
								>
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2 min-w-0">
											<TemplateIcon templateKey={template.key} name={template.name} className="h-5 w-5" />
											<h4 className="text-[13px] font-bold text-white truncate">{template.name}</h4>
										</div>
										<span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-400/90 border border-amber-500/20 rounded-md px-1.5 py-0.5">
											{template.category}
										</span>
									</div>
									<p className="text-xs text-zinc-400 line-clamp-2">{template.description}</p>
									<div className="text-[11px] font-mono text-zinc-500 truncate">
										{template.service}:{template.port}
									</div>
								</button>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
