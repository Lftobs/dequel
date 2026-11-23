import { listNotificationChannels } from "../db/repo/notifications";
import type { NotificationEvent } from "../types";
import { validateDestination } from "../utils/destination";
import { sendEventEmail } from "./notifier";

export interface EventPayload {
	title: string;
	message: string;
	projectName?: string;
	url?: string;
	channel?: string;
	destination?: string | null;
}

const postJson = async (url: string, payload: unknown, headers?: Record<string, string>) => {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...(headers ?? {}) },
		body: JSON.stringify(payload),
		redirect: "manual",
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) throw new Error(`Notification endpoint returned ${res.status}`);
};

const sendChannel = async (channel: string, destination: string | null, payload: EventPayload): Promise<void> => {
	if (!destination) throw new Error(`No destination configured for ${channel}`);
	if (channel !== "email") {
		const destinationError = await validateDestination(destination);
		if (destinationError) throw new Error(destinationError);
	}
	switch (channel) {
		case "email":
			await sendEventEmail(destination, payload.title, payload.message);
			return;
		case "slack":
		case "mattermost":
			await postJson(destination, { text: `*${payload.title}*\n${payload.message}` });
			return;
		case "discord":
			await postJson(destination, { content: `**${payload.title}**\n${payload.message}` });
			return;
		case "webhook":
			await postJson(destination, {
				event: payload.title,
				message: payload.message,
				project: payload.projectName,
				url: payload.url,
				timestamp: new Date().toISOString(),
			});
			return;
		case "telegram": {
			const [botToken, chatId] = destination.split("|");
			if (!botToken || !chatId) throw new Error("Telegram destination must be botToken|chatId");
			await postJson(`https://api.telegram.org/bot${botToken}/sendMessage`, {
				chat_id: chatId,
				text: `${payload.title}\n${payload.message}`,
			});
			return;
		}
		case "pushover": {
			const [appToken, userKey] = destination.split("|");
			if (!appToken || !userKey) throw new Error("Pushover destination must be appToken|userKey");
			const body = new URLSearchParams({
				token: appToken,
				user: userKey,
				title: payload.title,
				message: payload.message,
			});
			const res = await fetch("https://api.pushover.net/1/messages.json", {
				method: "POST",
				body,
				signal: AbortSignal.timeout(10_000),
			});
			if (!res.ok) throw new Error(`Pushover returned ${res.status}`);
			return;
		}
		case "ntfy": {
			const res = await fetch(destination, {
				method: "POST",
				headers: { Title: payload.title, Priority: "default" },
				body: payload.message,
				signal: AbortSignal.timeout(10_000),
			});
			if (!res.ok) throw new Error(`ntfy returned ${res.status}`);
			return;
		}
		case "gotify": {
			const [baseUrl, token] = destination.split("|");
			if (!baseUrl || !token) throw new Error("Gotify destination must be https://host|token");
			await postJson(`${baseUrl.replace(/\/$/, "")}/message?token=${encodeURIComponent(token)}`, {
				title: payload.title,
				message: payload.message,
				priority: 5,
			});
			return;
		}
		default:
			throw new Error(`Unknown notification channel: ${channel}`);
	}
};

export const sendEventNotification = async (
	event: NotificationEvent,
	payload: EventPayload,
): Promise<{ channel: string; status: "sent" | "failed"; error?: string }[]> => {
	const targets = payload.channel
		? [{ channel: payload.channel, destination: payload.destination ?? null }]
		: (await listNotificationChannels())
				.filter((channel) => channel.enabled && channel.events.includes(event))
				.map((channel) => ({ channel: channel.channel, destination: channel.destination }));
	const results: { channel: string; status: "sent" | "failed"; error?: string }[] = [];
	for (const target of targets) {
		try {
			await sendChannel(target.channel, target.destination, payload);
			results.push({ channel: target.channel, status: "sent" });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`[Notifications] ${target.channel} delivery failed:`, message);
			results.push({ channel: target.channel, status: "failed", error: message });
		}
	}
	return results;
};
