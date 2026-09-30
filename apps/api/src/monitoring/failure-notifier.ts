import {
	claimFailureNotification,
	listPendingFailureNotificationIds,
	markFailureNotificationSent,
} from "../db/repo/deployment-events";
import { onDeploymentFailed } from "../events";
import { config } from "../utils/config";
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
				if (!(await isSmtpConfigured())) {
					if (!configuredWarned) {
						console.warn("[FailureNotifier] SMTP not configured — leaving failure events pending");
						configuredWarned = true;
					}
					continue;
				}
				configuredWarned = false;
				const ctx = await claimFailureNotification(eventId);
				if (!ctx) continue;
				const delivery = await sendDeploymentFailureEmail(ctx);
				if (delivery.status === "sent") {
					await markFailureNotificationSent(eventId);
					console.log(`[FailureNotifier] failure email sent for ${ctx.deploymentId} (attempt ${ctx.attempt})`);
				} else {
					console.warn(
						`[FailureNotifier] ${ctx.deploymentId}: ${delivery.status}`,
						"reason" in delivery ? delivery.reason : delivery.error,
					);
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
