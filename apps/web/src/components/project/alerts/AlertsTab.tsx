import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../../../api/client";
import { Card, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
	Trash2,
	BellOff,
	Cpu,
	Layers,
	AlertTriangle,
	WifiOff,
	ShieldAlert,
	Plus,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../../ui/dialog";

interface AlertsTabProps {
	projectId: string;
}

const getAlertIcon = (type: string) => {
	switch (type) {
		case "cpu":
			return Cpu;
		case "memory":
			return Layers;
		case "error_rate":
			return AlertTriangle;
		case "downtime":
			return WifiOff;
		case "cert_expiry":
			return ShieldAlert;
		default:
			return Cpu;
	}
};

const getUnit = (type: string) => {
	switch (type) {
		case "cpu":
		case "memory":
		case "error_rate":
			return "%";
		case "cert_expiry":
			return " days";
		case "downtime":
			return "s";
		default:
			return "";
	}
};

export function AlertsTab({ projectId }: AlertsTabProps) {
	const { data: alerts = [], refetch } = useQuery({
		queryKey: ["alerts", projectId],
		queryFn: () => api.listAlerts(projectId),
	});

	const [isOpen, setIsOpen] = useState(false);
	const [type, setType] = useState("cpu");
	const [threshold, setThreshold] = useState("80");
	const [channel, setChannel] = useState("email");

	const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);

	const handleDeleteAlert = async () => {
		if (!deletingAlertId) return;
		await api.deleteAlert(deletingAlertId);
		setDeletingAlertId(null);
		refetch();
	};

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		await api.createAlert(projectId, {
			type,
			threshold: Number(threshold),
			channel,
		} as any);
		setIsOpen(false);
		refetch();
	};

	return (
		<div className="space-y-6">
			{alerts.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-12 text-center bg-card/20 backdrop-blur-sm relative overflow-hidden group min-h-[350px]">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
					<div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1a1a1f] to-[#121215] border border-border flex items-center justify-center mb-6 shadow-xl group-hover:border-primary/30 transition-colors duration-300">
						<div className="absolute inset-0 bg-primary/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
						<BellOff className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
					</div>
					<h3 className="text-lg font-semibold text-foreground mb-2">
						No Alert Rules Configured
					</h3>
					<p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
						Monitor system health and receive notifications when
						CPU, memory, error rates, or certificate status cross
						your limits.
					</p>
					<Button
						onClick={() => setIsOpen(true)}
						className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2 px-5 py-2 rounded-xl transition-all shadow-lg hover:shadow-primary/20"
					>
						<Plus className="h-4 w-4" /> Create Alert Rule
					</Button>
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								Alert Rules
							</h2>
							<p className="text-sm text-muted-foreground">
								Configure notifications for resource utilization
								spikes and uptime changes.
							</p>
						</div>
						<Button
							onClick={() => setIsOpen(true)}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl transition-all shadow-md"
						>
							<Plus className="h-4.5 w-4.5" /> Add Rule
						</Button>
					</div>

					<div className="grid gap-3">
						{alerts.map((a) => {
							const Icon = getAlertIcon(a.type);
							return (
								<div
									key={a.id}
									className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 hover:bg-card/80 transition-all gap-4 group"
								>
									<div className="flex items-center gap-4">
										<div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/15">
											<Icon className="h-5 w-5" />
										</div>
										<div>
											<div className="flex items-center gap-2 flex-wrap">
												<span className="font-semibold text-sm capitalize text-foreground">
													{a.type.replace(
														"_",
														" ",
													)}
												</span>
												<Badge
													variant="outline"
													className="text-[10px] uppercase border-primary/20 text-primary bg-primary/5 px-2 py-0.5"
												>
													{a.channel}
												</Badge>
											</div>
											<p className="text-xs text-muted-foreground mt-1">
												Triggers when{" "}
												<span className="capitalize">
													{a.type.replace(
														"_",
														" ",
													)}
												</span>{" "}
												exceeds{" "}
												<span className="font-semibold text-foreground">
													{a.threshold}
													{getUnit(a.type)}
												</span>
											</p>
										</div>
									</div>
									<div className="flex items-center gap-4">
										<button
											type="button"
											onClick={() =>
												api
													.toggleAlert(
														a.id,
														!a.enabled,
													)
													.then(() => refetch())
											}
											className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
												a.enabled
													? "bg-primary"
													: "bg-muted"
											}`}
											aria-label="Toggle Alert Rule"
										>
											<span
												className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-md ring-0 transition duration-200 ease-in-out ${
													a.enabled
														? "translate-x-4"
														: "translate-x-0"
												}`}
											/>
										</button>

										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-80 group-hover:opacity-100 transition-all"
											onClick={() =>
												setDeletingAlertId(a.id)
											}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Create Alert Rule
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Set up monitoring for your project. Notifications
							will be triggered when thresholds are crossed.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={add} className="space-y-4 pt-2">
						<div className="grid gap-2">
							<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Metric Type
							</label>
							<select
								value={type}
								onChange={(e) => setType(e.target.value)}
								className="flex h-10 w-full rounded-lg border border-input bg-[#0d0d11] px-3 py-2 text-sm shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
							>
								<option value="cpu">CPU Usage</option>
								<option value="memory">Memory Usage</option>
								<option value="error_rate">
									HTTP Error Rate
								</option>
								<option value="downtime">
									Downtime Detect
								</option>
								<option value="cert_expiry">
									SSL Cert Expiry
								</option>
							</select>
						</div>

						<div className="grid gap-2">
							<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Threshold{" "}
								{getUnit(type) &&
									`(${getUnit(type).trim()})`}
							</label>
							<div className="relative flex items-center">
								<Input
									type="number"
									min={1}
									value={threshold}
									onChange={(e) =>
										setThreshold(e.target.value)
									}
									className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg pr-10"
									required
								/>
								{getUnit(type) && (
									<span className="absolute right-3 text-xs font-semibold text-muted-foreground">
										{getUnit(type).trim()}
									</span>
								)}
							</div>
						</div>

						<div className="grid gap-2">
							<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Notification Channel
							</label>
							<select
								value={channel}
								onChange={(e) => setChannel(e.target.value)}
								className="flex h-10 w-full rounded-lg border border-input bg-[#0d0d11] px-3 py-2 text-sm shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
							>
								<option value="email">Email Notification</option>
							</select>
						</div>

						<div className="flex justify-end gap-2 pt-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setIsOpen(false)}
								className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all"
							>
								Create Rule
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={deletingAlertId !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingAlertId(null);
				}}
			>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Delete Alert Rule
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Are you sure you want to delete this alert rule? You will
							no longer receive notifications for this condition.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() => setDeletingAlertId(null)}
							className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							onClick={handleDeleteAlert}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all"
						>
							Delete Rule
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
