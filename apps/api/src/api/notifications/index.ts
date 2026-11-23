import { Elysia } from "elysia";
import {
	createNotificationChannel,
	deleteNotificationChannel,
	listNotificationChannels,
	updateNotificationChannel,
} from "../../db/repo";
import { sendEventNotification } from "../../monitoring/notifications";
import type { NotificationEvent } from "../../types";
import { created, fail, ok } from "../response";

const NOTIFICATION_EVENTS: ReadonlySet<string> = new Set<NotificationEvent>([
	"deployment_failed",
	"deployment_succeeded",
	"backup_failed",
	"backup_succeeded",
	"server_offline",
	"alert",
]);

const validateEvents = (events: unknown): NotificationEvent[] => {
	if (!Array.isArray(events)) return [];
	return [...new Set(events.map(String).filter((event) => NOTIFICATION_EVENTS.has(event)))] as NotificationEvent[];
};

export const notificationsRoutes = new Elysia()
	.get("/notifications", async () => ok(await listNotificationChannels()))
	.post("/notifications", async ({ body, set }: any) => {
		if (!body?.name || !body?.channel) {
			set.status = 400;
			return fail("name and channel are required");
		}
		return created(
			await createNotificationChannel({
				name: body.name,
				channel: body.channel,
				destination: body.destination || null,
				events: validateEvents(body.events),
				enabled: body.enabled ?? true,
			}),
		);
	})
	.patch("/notifications/:id", async ({ params: { id }, body, set }: any) => {
		const channel = await updateNotificationChannel(id, {
			name: body?.name,
			channel: body?.channel,
			destination: body?.destination,
			events: body?.events !== undefined ? validateEvents(body.events) : undefined,
			enabled: body?.enabled,
		});
		if (!channel) {
			set.status = 404;
			return fail("Notification channel not found");
		}
		return ok(channel);
	})
	.delete("/notifications/:id", async ({ params: { id }, set }) => {
		if (!(await deleteNotificationChannel(id))) {
			set.status = 404;
			return fail("Notification channel not found");
		}
		return ok(null, "Notification channel deleted");
	})
	.post("/notifications/test", async ({ body, set }: any) => {
		if (!body?.channel) {
			set.status = 400;
			return fail("channel is required");
		}
		const results = await sendEventNotification("alert", {
			title: "Dequel test notification",
			message: "If you can read this, the channel is configured correctly.",
			channel: body.channel,
			destination: body.destination,
		});
		return ok(results);
	});
