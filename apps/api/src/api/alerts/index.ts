import { Elysia } from "elysia";
import {
	createAlert,
	deleteAlert,
	listAlerts,
	updateAlertEnabled,
} from "../../db/repo";

export const alertsRoutes = new Elysia()
	.get(
		"/projects/:id/alerts",
		async ({ params }) => listAlerts(params.id),
	)
	.post(
		"/projects/:id/alerts",
		async ({ params, body, set }: any) => {
			if (!body?.type || !body?.channel) {
				set.status = 400;
				return { error: "type and channel are required" };
			}
			return createAlert({
				projectId: params.id,
				type: body.type,
				threshold: body.threshold,
				durationSeconds: body.durationSeconds,
				channel: body.channel,
				destination: body.destination,
			});
		},
	)
	.patch(
		"/alerts/:id",
		async ({ params: { id }, body, set }: any) => {
			if (body?.enabled === undefined) {
				set.status = 400;
				return { error: "enabled is required" };
			}
			const alert = await updateAlertEnabled(id, body.enabled);
			if (!alert) {
				set.status = 404;
				return { error: "Alert not found" };
			}
			return alert;
		},
	)
	.delete(
		"/alerts/:id",
		async ({ params: { id }, set }) => {
			const ok = await deleteAlert(id);
			if (!ok) {
				set.status = 404;
				return { error: "Alert not found" };
			}
			return { ok: true };
		},
	);
