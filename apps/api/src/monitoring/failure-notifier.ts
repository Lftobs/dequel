import {
	claimFailureNotification,
	listPendingFailureNotificationIds,
	markFailureNotificationSent,
} from "../db/repo/deployment-events";
import { listNotificationChannels } from "../db/repo/notifications";
import { onDeploymentFailed } from "../events";
import { config } from "../utils/config";
import { sendEventNotification } from "./notifications";
import { isSmtpConfigured, sendDeploymentFailureEmail } from "./notifier";

let queue: string[] = [];
const pending = new Set<string>();
let draining = false;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribe: (() => void) | null = null;
let configuredWarned = false;

const enqueue = (eventId: string) => {
	if (pending.has(eventId)) return;
	pending.add(eventId);
	queue.push(eventId);
	void drain();
};

const drain = async () => {
	if (draining) return;
	draining = true;
	try {
		while (queue.length > 0) {
			const eventId = queue.shift()!;
			pending.delete(eventId);
			try {
				const smtpConfigured = await isSmtpConfigured();
				const eventChannels = await listNotificationChannels().catch(() => []);
				const hasEventChannel = eventChannels.some(
					(channel) => channel.enabled && channel.events.includes("deployment_failed"),
				);
				if (!smtpConfigured && !hasEventChannel) {
					if (!configuredWarned) {
						console.warn("[FailureNotifier] no email or notification channel configured — leaving events pending");
						configuredWarned = true;
					}
					continue;
				}
				configuredWarned = false;
				const ctx = await claimFailureNotification(eventId);
				if (!ctx) continue;
				const delivery = smtpConfigured
					? await sendDeploymentFailureEmail(ctx)
					: ({ status: "skipped", reason: "no_smtp" } as const);
				const channelResults = await sendEventNotification("deployment_failed", {
					title: `Deployment failed: ${ctx.projectName}`,
					message: ctx.failureReason ?? "The deployment failed.",
					projectName: ctx.projectName,
					url: ctx.projectId
						? `${config.caddyBaseDomain === "localhost" ? "http://localhost" : `https://${config.caddyBaseDomain}`}/project/${ctx.projectId}`
						: undefined,
				});
				const channelSent = channelResults.some((result) => result.status === "sent");
				if (delivery.status === "sent" || channelSent) {
					await markFailureNotificationSent(eventId);
					console.log(`[FailureNotifier] failure notification sent for ${ctx.deploymentId} (attempt ${ctx.attempt})`);
				} else {
					console.warn(`[FailureNotifier] ${ctx.deploymentId}: no notification channel delivered`);
				}
			} catch (err) {
				console.error(`[FailureNotifier] ${eventId}:`, err);
			}
		}
	} finally {
		draining = false;
	}
};

const sweep = async () => {
	try {
		const ids = await listPendingFailureNotificationIds();
		for (const id of ids) enqueue(id);
	} catch (err) {
		console.error("[FailureNotifier] sweep failed:", err);
	}
};

export const startFailureNotifier = (): void => {
	if (unsubscribe) return;
	unsubscribe = onDeploymentFailed((signal) => enqueue(signal.eventId));
	sweepTimer = setInterval(() => void sweep(), config.failureSweepIntervalMs);
	void sweep();
	console.log("[FailureNotifier] started");
};

export const stopFailureNotifier = (): void => {
	unsubscribe?.();
	unsubscribe = null;
	if (sweepTimer) clearInterval(sweepTimer);
	sweepTimer = null;
	queue = [];
	pending.clear();
};
