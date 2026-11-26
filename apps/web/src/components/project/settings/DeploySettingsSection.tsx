import { Activity, CheckCircle, RotateCw, Save, SquareTerminal } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useUpdateProject } from "../../../hooks/useProjects";
import type { HealthCheckConfig, HealthCheckType, Project, RestartPolicy } from "../../../types";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";

interface DeploySettingsSectionProps {
	project: Project;
}

const defaultHealthCheck: HealthCheckConfig = {
	type: "none",
	path: "/",
	port: null,
	command: null,
	intervalSeconds: 10,
	timeoutSeconds: 3,
	startPeriodSeconds: 5,
	retries: 3,
};

export function DeploySettingsSection({ project }: DeploySettingsSectionProps) {
	const updateProjectMutation = useUpdateProject();

	const [healthCheck, setHealthCheck] = useState<HealthCheckConfig>(defaultHealthCheck);
	const [restartPolicy, setRestartPolicy] = useState<RestartPolicy>("unless-stopped");
	const [restartMaxRetries, setRestartMaxRetries] = useState("");
	const [stopGracePeriodSeconds, setStopGracePeriodSeconds] = useState("");
	const [preDeployCommand, setPreDeployCommand] = useState("");
	const [postDeployCommand, setPostDeployCommand] = useState("");
	const [cancelOlderDeployments, setCancelOlderDeployments] = useState(true);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (project) {
			setHealthCheck({ ...defaultHealthCheck, ...(project.healthCheck ?? {}) });
			setRestartPolicy(project.restartPolicy || "unless-stopped");
			setRestartMaxRetries(project.restartMaxRetries === null ? "" : String(project.restartMaxRetries));
			setStopGracePeriodSeconds(project.stopGracePeriodSeconds === null ? "" : String(project.stopGracePeriodSeconds));
			setPreDeployCommand(project.preDeployCommand || "");
			setPostDeployCommand(project.postDeployCommand || "");
			setCancelOlderDeployments(project.cancelOlderDeployments);
		}
	}, [project]);

	const patchHealthCheck = (patch: Partial<HealthCheckConfig>) => {
		setHealthCheck((current) => ({ ...current, ...patch }));
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		try {
			const payload: HealthCheckConfig =
				healthCheck.type === "none"
					? { type: "none" }
					: {
							type: healthCheck.type,
							path: healthCheck.type === "http" ? healthCheck.path || "/" : null,
							port: healthCheck.port ? Number(healthCheck.port) : null,
							command: healthCheck.type === "command" ? healthCheck.command || null : null,
							intervalSeconds: Number(healthCheck.intervalSeconds ?? 10),
							timeoutSeconds: Number(healthCheck.timeoutSeconds ?? 3),
							startPeriodSeconds: Number(healthCheck.startPeriodSeconds ?? 5),
							retries: Number(healthCheck.retries ?? 3),
						};
			await updateProjectMutation.mutateAsync({
				id: project.id,
				healthCheck: payload,
				restartPolicy,
				restartMaxRetries: restartPolicy === "on-failure" && restartMaxRetries ? Number(restartMaxRetries) : null,
				stopGracePeriodSeconds: stopGracePeriodSeconds ? Number(stopGracePeriodSeconds) : null,
				preDeployCommand: preDeployCommand.trim() || null,
				postDeployCommand: postDeployCommand.trim() || null,
				cancelOlderDeployments,
			});
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err: any) {
			setError(err.message || "Failed to save deploy settings");
		}
	};

	return (
		<Card className="bg-[#0c0c0e]/60 border-[#222227] rounded-xl overflow-hidden">
			<CardContent className="p-6">
				<form onSubmit={handleSave} className="space-y-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#222227]">
						<div>
							<h3 className="text-zinc-200 font-bold text-base">Deploy & Runtime</h3>
							<p className="text-zinc-500 text-xs mt-1">
								Health probes, restart behavior, deploy hooks, and deployment concurrency.
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

					{error && (
						<div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">{error}</div>
					)}

					<div className="space-y-4">
						<div className="flex items-center gap-2">
							<Activity className="h-4 w-4 text-orange-500" />
							<h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Health Check</h4>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-2">
								<label htmlFor="dep-health-type" className="font-semibold text-xs text-zinc-400">
									Probe Type
								</label>
								<select
									id="dep-health-type"
									value={healthCheck.type}
									onChange={(e) => patchHealthCheck({ type: e.target.value as HealthCheckType })}
									className="h-9 w-full rounded-lg border border-[#222227] bg-[#141418] px-3 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
								>
									<option value="none">Disabled</option>
									<option value="http">HTTP request</option>
									<option value="tcp">TCP connection</option>
									<option value="command">Container command</option>
								</select>
							</div>

							{healthCheck.type === "http" && (
								<div className="space-y-2">
									<label htmlFor="dep-health-path" className="font-semibold text-xs text-zinc-400">
										HTTP Path
									</label>
									<Input
										id="dep-health-path"
										placeholder="/health"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={healthCheck.path || ""}
										onChange={(e) => patchHealthCheck({ path: e.target.value })}
									/>
								</div>
							)}

							{healthCheck.type !== "none" && healthCheck.type !== "command" && (
								<div className="space-y-2">
									<label htmlFor="dep-health-port" className="font-semibold text-xs text-zinc-400">
										Probe Port
									</label>
									<Input
										id="dep-health-port"
										type="number"
										placeholder={project.port ? String(project.port) : "3000"}
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={healthCheck.port ?? ""}
										onChange={(e) => patchHealthCheck({ port: e.target.value ? Number(e.target.value) : null })}
									/>
								</div>
							)}

							{healthCheck.type === "command" && (
								<div className="space-y-2 sm:col-span-2">
									<label htmlFor="dep-health-command" className="font-semibold text-xs text-zinc-400">
										Container Command
									</label>
									<Input
										id="dep-health-command"
										placeholder="e.g. curl -f http://localhost:3000/health || exit 1"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={healthCheck.command || ""}
										onChange={(e) => patchHealthCheck({ command: e.target.value })}
									/>
								</div>
							)}
						</div>

						{healthCheck.type !== "none" && (
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
								<div className="space-y-2">
									<label htmlFor="dep-health-interval" className="font-semibold text-[11px] text-zinc-400">
										Interval (s)
									</label>
									<Input
										id="dep-health-interval"
										type="number"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={healthCheck.intervalSeconds ?? 10}
										onChange={(e) => patchHealthCheck({ intervalSeconds: Number(e.target.value) })}
									/>
								</div>
								<div className="space-y-2">
									<label htmlFor="dep-health-timeout" className="font-semibold text-[11px] text-zinc-400">
										Timeout (s)
									</label>
									<Input
										id="dep-health-timeout"
										type="number"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={healthCheck.timeoutSeconds ?? 3}
										onChange={(e) => patchHealthCheck({ timeoutSeconds: Number(e.target.value) })}
									/>
								</div>
								<div className="space-y-2">
									<label htmlFor="dep-health-start" className="font-semibold text-[11px] text-zinc-400">
										Start Period (s)
									</label>
									<Input
										id="dep-health-start"
										type="number"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={healthCheck.startPeriodSeconds ?? 5}
										onChange={(e) => patchHealthCheck({ startPeriodSeconds: Number(e.target.value) })}
									/>
								</div>
								<div className="space-y-2">
									<label htmlFor="dep-health-retries" className="font-semibold text-[11px] text-zinc-400">
										Retries
									</label>
									<Input
										id="dep-health-retries"
										type="number"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={healthCheck.retries ?? 3}
										onChange={(e) => patchHealthCheck({ retries: Number(e.target.value) })}
									/>
								</div>
							</div>
						)}

						<div className="pt-4 border-t border-[#222227] space-y-4">
							<div className="flex items-center gap-2">
								<RotateCw className="h-4 w-4 text-orange-500" />
								<h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Restart Policy</h4>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<div className="space-y-2">
									<label htmlFor="dep-restart" className="font-semibold text-xs text-zinc-400">
										Policy
									</label>
									<select
										id="dep-restart"
										value={restartPolicy}
										onChange={(e) => setRestartPolicy(e.target.value as RestartPolicy)}
										className="h-9 w-full rounded-lg border border-[#222227] bg-[#141418] px-3 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
									>
										<option value="always">Always restart</option>
										<option value="unless-stopped">Unless stopped</option>
										<option value="on-failure">On failure</option>
										<option value="no">Never restart</option>
									</select>
								</div>
								{restartPolicy === "on-failure" && (
									<div className="space-y-2">
										<label htmlFor="dep-restart-retries" className="font-semibold text-xs text-zinc-400">
											Max Retries
										</label>
										<Input
											id="dep-restart-retries"
											type="number"
											placeholder="unlimited"
											className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
											value={restartMaxRetries}
											onChange={(e) => setRestartMaxRetries(e.target.value)}
										/>
									</div>
								)}
								<div className="space-y-2">
									<label htmlFor="dep-stop-grace" className="font-semibold text-xs text-zinc-400">
										Stop Grace (s)
									</label>
									<Input
										id="dep-stop-grace"
										type="number"
										placeholder="10"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={stopGracePeriodSeconds}
										onChange={(e) => setStopGracePeriodSeconds(e.target.value)}
									/>
								</div>
							</div>
						</div>

						<div className="pt-4 border-t border-[#222227] space-y-4">
							<div className="flex items-center gap-2">
								<SquareTerminal className="h-4 w-4 text-orange-500" />
								<h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Deploy Hooks</h4>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="space-y-2">
									<label htmlFor="dep-pre-command" className="font-semibold text-xs text-zinc-400">
										Pre-Deploy Command
									</label>
									<Input
										id="dep-pre-command"
										placeholder="e.g. bun run db:migrate"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={preDeployCommand}
										onChange={(e) => setPreDeployCommand(e.target.value)}
									/>
									<p className="text-[10px] text-zinc-500 leading-normal">
										Runs inside a throwaway container before traffic switches to the new release.
									</p>
								</div>
								<div className="space-y-2">
									<label htmlFor="dep-post-command" className="font-semibold text-xs text-zinc-400">
										Post-Deploy Command
									</label>
									<Input
										id="dep-post-command"
										placeholder="e.g. bun run cache:warm"
										className="bg-[#141418] border-[#222227] focus:border-orange-500 text-zinc-200 text-xs h-9 rounded-lg font-mono"
										value={postDeployCommand}
										onChange={(e) => setPostDeployCommand(e.target.value)}
									/>
									<p className="text-[10px] text-zinc-500 leading-normal">
										Runs inside the new container after it starts. Failures are logged, not fatal.
									</p>
								</div>
							</div>
						</div>

						<div className="pt-4 border-t border-[#222227]">
							<label className="flex items-start gap-3 cursor-pointer select-none">
								<input
									type="checkbox"
									checked={cancelOlderDeployments}
									onChange={(e) => setCancelOlderDeployments(e.target.checked)}
									className="mt-0.5 h-4 w-4 rounded border-[#333] bg-[#141418] accent-orange-500"
								/>
								<span>
									<span className="block text-xs font-semibold text-zinc-300">Cancel Older Deployments</span>
									<span className="block text-[10px] text-zinc-500 mt-0.5">
										Mark in-flight deployments as cancelled when a newer deployment starts.
									</span>
								</span>
							</label>
						</div>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
