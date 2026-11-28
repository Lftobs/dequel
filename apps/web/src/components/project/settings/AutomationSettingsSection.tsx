import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Copy, Megaphone, RefreshCw, Save, Tags, Webhook } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import * as api from "../../../api/client";
import { useUpdateProject } from "../../../hooks/useProjects";
import type { Project } from "../../../types";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";

interface AutomationSettingsSectionProps {
	project: Project;
}

const parseTags = (value: string) =>
	[
		...new Set(
			value
				.split(/[,\s]+/)
				.map((tag) => tag.trim().toLowerCase())
				.filter((tag) => tag.length > 0),
		),
	].slice(0, 20);

export function AutomationSettingsSection({ project }: AutomationSettingsSectionProps) {
	const updateProjectMutation = useUpdateProject();
	const queryClient = useQueryClient();

	const [tags, setTags] = useState("");
	const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
	const [maintenanceMessage, setMaintenanceMessage] = useState("");
	const [webhookToken, setWebhookToken] = useState<string | null>(project.deployWebhookToken);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [copied, setCopied] = useState(false);
	const [regenerating, setRegenerating] = useState(false);

	useEffect(() => {
		if (project) {
			setTags((project.tags ?? []).join(", "));
			setMaintenanceEnabled(project.maintenanceEnabled);
			setMaintenanceMessage(project.maintenanceMessage || "");
			setWebhookToken(project.deployWebhookToken);
		}
	}, [project]);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await updateProjectMutation.mutateAsync({
				id: project.id,
				tags: parseTags(tags),
				maintenanceEnabled,
				maintenanceMessage: maintenanceEnabled ? maintenanceMessage.trim() || null : null,
			});
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err) {
			console.error("Failed to update automation settings:", err);
		}
	};

	const handleRegenerate = async () => {
		setRegenerating(true);
		try {
			const result = await api.regenerateDeployWebhookToken(project.id);
			setWebhookToken(result.token);
			queryClient.invalidateQueries({ queryKey: ["project", project.id] });
		} catch (err) {
			console.error("Failed to regenerate webhook token:", err);
		} finally {
			setRegenerating(false);
		}
	};

	const webhookUrl =
		typeof window === "undefined" || !webhookToken
			? ""
			: `${window.location.origin}/api/webhooks/deploy/${webhookToken}`;

	const handleCopy = async () => {
		if (!webhookUrl) return;
		try {
			await navigator.clipboard.writeText(webhookUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	return (
		<Card className="bg-[#0c0c0e]/60 border-[#222227] rounded-xl overflow-hidden">
			<CardContent className="p-6">
				<form onSubmit={handleSave} className="space-y-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#222227]">
						<div>
							<h3 className="text-zinc-200 font-bold text-base">Automation</h3>
							<p className="text-zinc-500 text-xs mt-1">
								Group deploys by tag, trigger builds from CI, and set maintenance mode.
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

					<div className="space-y-2">
						<label htmlFor="auto-tags" className="font-semibold text-xs text-zinc-400 flex items-center gap-1.5">
							<Tags className="h-3.5 w-3.5 text-orange-500" />
							Tags
						</label>
						<Input
							id="auto-tags"
							placeholder="e.g. frontend, api, production"
							className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
							value={tags}
							onChange={(e) => setTags(e.target.value)}
						/>
						<p className="text-[10px] text-zinc-500 leading-normal">
							Comma or space separated. Use{" "}
							<code className="text-zinc-300">POST /api/projects/by-tag/&lt;tag&gt;/deploy</code> to deploy every
							project with a tag in one request.
						</p>
					</div>

					<div className="pt-4 border-t border-[#222227] space-y-3">
						<div className="flex items-center gap-1.5">
							<Webhook className="h-3.5 w-3.5 text-orange-500" />
							<span className="font-semibold text-xs text-zinc-400">Deploy Webhook</span>
						</div>
						<div className="flex flex-col sm:flex-row gap-2">
							<Input
								readOnly
								value={webhookUrl}
								className="bg-[#141418] border-[#222227] text-zinc-300 text-xs h-9 rounded-lg font-mono flex-1"
							/>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={handleCopy}
									disabled={!webhookUrl}
									className="border-[#222227] text-zinc-300 hover:bg-[#1a1a20] h-9 text-xs"
								>
									{copied ? <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
									{copied ? "Copied" : "Copy"}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={handleRegenerate}
									disabled={regenerating}
									className="border-[#222227] text-zinc-300 hover:bg-[#1a1a20] h-9 text-xs"
								>
									<RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerating ? "animate-spin" : ""}`} />
									Rotate
								</Button>
							</div>
						</div>
						<p className="text-[10px] text-zinc-500 leading-normal">
							Send a POST request to this URL (no auth header needed) to deploy the current branch. Rotating invalidates
							the previous URL immediately.
						</p>
					</div>

					<div className="pt-4 border-t border-[#222227] space-y-3">
						<label className="flex items-start gap-3 cursor-pointer select-none">
							<input
								type="checkbox"
								checked={maintenanceEnabled}
								onChange={(e) => setMaintenanceEnabled(e.target.checked)}
								className="mt-0.5 h-4 w-4 rounded border-[#333] bg-[#141418] accent-orange-500"
							/>
							<span>
								<span className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
									<Megaphone className="h-3.5 w-3.5 text-orange-500" />
									Maintenance Mode
								</span>
								<span className="block text-[10px] text-zinc-500 mt-0.5">
									Show a maintenance page instead of routing traffic to the running container.
								</span>
							</span>
						</label>
						{maintenanceEnabled && (
							<div className="space-y-2 pl-7">
								<label htmlFor="auto-maintenance-message" className="font-semibold text-xs text-zinc-400">
									Maintenance Message
								</label>
								<Input
									id="auto-maintenance-message"
									placeholder="We are performing scheduled maintenance. Please check back soon."
									className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg"
									value={maintenanceMessage}
									onChange={(e) => setMaintenanceMessage(e.target.value)}
								/>
							</div>
						)}
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
