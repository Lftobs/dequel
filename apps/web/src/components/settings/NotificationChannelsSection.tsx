import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import * as api from "../../api/client";
import type { NotificationChannel, NotificationEvent } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

const CHANNELS = [
	{ value: "email", label: "Email", hint: "recipient@example.com" },
	{ value: "slack", label: "Slack", hint: "https://hooks.slack.com/services/..." },
	{ value: "discord", label: "Discord", hint: "https://discord.com/api/webhooks/..." },
	{ value: "mattermost", label: "Mattermost", hint: "https://mattermost.example.com/hooks/..." },
	{ value: "webhook", label: "Generic Webhook", hint: "https://example.com/dequel-events" },
	{ value: "telegram", label: "Telegram", hint: "botToken|chatId" },
	{ value: "pushover", label: "Pushover", hint: "appToken|userKey" },
	{ value: "ntfy", label: "ntfy", hint: "https://ntfy.sh/dequel" },
	{ value: "gotify", label: "Gotify", hint: "https://gotify.example.com|token" },
];

const EVENTS: Array<{ value: NotificationEvent; label: string }> = [
	{ value: "deployment_failed", label: "Deployment failed" },
	{ value: "deployment_succeeded", label: "Deployment succeeded" },
	{ value: "backup_failed", label: "Backup failed" },
	{ value: "backup_succeeded", label: "Backup succeeded" },
	{ value: "server_offline", label: "Server offline" },
	{ value: "alert", label: "Monitoring alert" },
];

interface FormState {
	name: string;
	channel: string;
	destination: string;
	events: NotificationEvent[];
	enabled: boolean;
}

const emptyForm: FormState = {
	name: "",
	channel: "slack",
	destination: "",
	events: ["deployment_failed"],
	enabled: true,
};

export function NotificationChannelsSection() {
	const queryClient = useQueryClient();
	const { data: channels = [], refetch } = useQuery({
		queryKey: ["notification-channels"],
		queryFn: () => api.listNotificationChannels().catch(() => []),
	});

	const [isCreating, setIsCreating] = useState(false);
	const [editing, setEditing] = useState<NotificationChannel | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [testingId, setTestingId] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<{ id: string; text: string; ok: boolean } | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const patch = (value: Partial<FormState>) => setForm((current) => ({ ...current, ...value }));

	const openCreate = () => {
		setEditing(null);
		setForm(emptyForm);
		setError("");
		setIsCreating(true);
	};

	const openEdit = (channel: NotificationChannel) => {
		setEditing(channel);
		setForm({
			name: channel.name,
			channel: channel.channel,
			destination: channel.destination || "",
			events: channel.events,
			enabled: channel.enabled,
		});
		setError("");
		setIsCreating(true);
	};

	const closeForm = () => {
		setIsCreating(false);
		setEditing(null);
		setForm(emptyForm);
		setError("");
	};

	const toggleEvent = (event: NotificationEvent) => {
		setForm((current) => ({
			...current,
			events: current.events.includes(event)
				? current.events.filter((item) => item !== event)
				: [...current.events, event],
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError("");
		try {
			const payload = {
				name: form.name.trim(),
				channel: form.channel,
				destination: form.destination.trim() || null,
				events: form.events,
				enabled: form.enabled,
			};
			if (editing) {
				await api.updateNotificationChannel(editing.id, payload);
			} else {
				await api.createNotificationChannel(payload);
			}
			closeForm();
			refetch();
			queryClient.invalidateQueries({ queryKey: ["notification-channels"] });
		} catch (err: any) {
			setError(err.message || "Failed to save notification channel");
		} finally {
			setSaving(false);
		}
	};

	const handleToggleEnabled = async (channel: NotificationChannel) => {
		setTestingId(channel.id);
		try {
			await api.updateNotificationChannel(channel.id, { enabled: !channel.enabled });
			refetch();
		} finally {
			setTestingId(null);
		}
	};

	const handleTest = async (channel: NotificationChannel) => {
		setTestingId(channel.id);
		setTestResult(null);
		try {
			const results = await api.testNotificationChannel({
				channel: channel.channel,
				destination: channel.destination,
			});
			const failed = results.find((result) => result.status === "failed");
			setTestResult({
				id: channel.id,
				ok: !failed,
				text: failed ? failed.error || "Delivery failed" : "Test notification sent",
			});
		} catch (err: any) {
			setTestResult({ id: channel.id, ok: false, text: err.message || "Test failed" });
		} finally {
			setTestingId(null);
		}
	};

	const handleDelete = async (id: string) => {
		setDeletingId(id);
		try {
			await api.deleteNotificationChannel(id);
			refetch();
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
							<Bell className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg font-semibold text-foreground">Notification Channels</CardTitle>
							<p className="text-xs text-muted-foreground mt-0.5">
								Send deployment, backup, and alert events to chat apps, email, or webhooks.
							</p>
						</div>
					</div>
					<Button
						onClick={isCreating ? closeForm : openCreate}
						size="sm"
						className="bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md transition-all gap-1.5 self-start sm:self-auto"
					>
						{isCreating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
						{isCreating ? "Close" : "Add Channel"}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-6 space-y-6">
				{isCreating && (
					<form onSubmit={handleSubmit} className="rounded-2xl border border-border/80 bg-background/40 p-5 space-y-4">
						{error && (
							<div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
								{error}
							</div>
						)}
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Channel Name</label>
								<Input
									placeholder="e.g. Deploy alerts"
									value={form.name}
									onChange={(e) => patch({ name: e.target.value })}
									className="bg-card border-border/80 text-xs"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Provider</label>
								<select
									value={form.channel}
									onChange={(e) => patch({ channel: e.target.value })}
									className="h-9 w-full rounded-md border border-border/80 bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
								>
									{CHANNELS.map((channel) => (
										<option key={channel.value} value={channel.value}>
											{channel.label}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-1.5 sm:col-span-2">
								<label className="text-xs font-medium text-foreground">Destination</label>
								<Input
									placeholder={CHANNELS.find((channel) => channel.value === form.channel)?.hint}
									value={form.destination}
									onChange={(e) => patch({ destination: e.target.value })}
									className="bg-card border-border/80 text-xs font-mono"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<span className="text-xs font-medium text-foreground">Trigger On</span>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{EVENTS.map((event) => (
									<label
										key={event.value}
										className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-card"
									>
										<input
											type="checkbox"
											checked={form.events.includes(event.value)}
											onChange={() => toggleEvent(event.value)}
											className="h-3.5 w-3.5 accent-orange-500"
										/>
										{event.label}
									</label>
								))}
							</div>
						</div>

						<label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
							<input
								type="checkbox"
								checked={form.enabled}
								onChange={(e) => patch({ enabled: e.target.checked })}
								className="h-3.5 w-3.5 accent-orange-500"
							/>
							Enabled
						</label>

						<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
							<Button type="button" variant="ghost" size="sm" onClick={closeForm} className="text-xs">
								Cancel
							</Button>
							<Button
								type="submit"
								size="sm"
								disabled={saving}
								className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-4"
							>
								{saving ? "Saving..." : editing ? "Save Channel" : "Add Channel"}
							</Button>
						</div>
					</form>
				)}

				{channels.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-12 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground mb-3">
							<Bell className="h-6 w-6" />
						</div>
						<h3 className="text-sm font-semibold text-foreground">No Notification Channels</h3>
						<p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
							Add Slack, Discord, Telegram, email, or webhook destinations to get notified about platform events.
						</p>
						<Button
							size="sm"
							onClick={openCreate}
							variant="outline"
							className="text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
						>
							Add First Channel
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						{channels.map((channel) => (
							<div key={channel.id} className="rounded-xl border border-border/60 bg-card/30 p-4 space-y-3">
								<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
									<div className="min-w-0 space-y-1">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="text-sm font-semibold text-foreground break-all">{channel.name}</span>
											<Badge variant="outline" className="text-[10px] uppercase">
												{channel.channel}
											</Badge>
											<Badge
												variant="outline"
												className={
													channel.enabled
														? "text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
														: "text-[10px] border-border text-muted-foreground"
												}
											>
												{channel.enabled ? "Enabled" : "Disabled"}
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground font-mono break-all">
											{channel.destination || "No destination set"}
										</p>
									</div>
									<div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
										<Button
											variant="ghost"
											size="sm"
											className="h-8 text-xs text-muted-foreground hover:text-foreground"
											disabled={testingId === channel.id}
											onClick={() => handleToggleEnabled(channel)}
										>
											{channel.enabled ? "Disable" : "Enable"}
										</Button>
										<Button
											variant="ghost"
											size="icon"
											title="Send test notification"
											className="h-8 w-8 text-muted-foreground hover:text-emerald-400"
											disabled={testingId === channel.id}
											onClick={() => handleTest(channel)}
										>
											<Send className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											title="Edit channel"
											className="h-8 w-8 text-muted-foreground hover:text-primary"
											onClick={() => openEdit(channel)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											title="Delete channel"
											className="h-8 w-8 text-muted-foreground hover:text-destructive"
											disabled={deletingId === channel.id}
											onClick={() => handleDelete(channel.id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
								<div className="flex flex-wrap gap-1.5">
									{EVENTS.filter((event) => channel.events.includes(event.value)).map((event) => (
										<span
											key={event.value}
											className="text-[10px] px-2 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border/40"
										>
											{event.label}
										</span>
									))}
									{channel.events.length === 0 && (
										<span className="text-[10px] text-amber-400">No events selected — this channel will not fire</span>
									)}
								</div>
								{testResult?.id === channel.id && (
									<div
										className={`flex items-center gap-1.5 text-[11px] ${
											testResult.ok ? "text-emerald-400" : "text-rose-400"
										}`}
									>
										<CheckCircle className="h-3.5 w-3.5" />
										{testResult.text}
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
