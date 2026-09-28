import { Elysia } from "elysia";
import { createAlert, deleteAlert, listAlerts, updateAlertEnabled } from "../../db/repo";
import type { AlertChannel, AlertType } from "../../types";
import { created, fail, ok } from "../response";

const ALERT_TYPES: ReadonlySet<string> = new Set<AlertType>(["cpu", "memory", "downtime", "cert_expiry"]);
const ALERT_CHANNELS: ReadonlySet<string> = new Set<AlertChannel>(["email", "slack", "webhook"]);

export const alertsRoutes = new Elysia()
	.get("/projects/:id/alerts", async ({ params }) => ok(await listAlerts(params.id)))
	.post("/projects/:id/alerts", async ({ params, body, set }: any) => {
		if (!body?.type || !body?.channel) {
			set.status = 400;
			return fail("type and channel are required");
		}
		if (!ALERT_TYPES.has(String(body.type))) {
			set.status = 400;
			return fail(`type must be one of: ${[...ALERT_TYPES].join(", ")}`);
		}
		if (!ALERT_CHANNELS.has(String(body.channel))) {
			set.status = 400;
			return fail(`channel must be one of: ${[...ALERT_CHANNELS].join(", ")}`);
		}
		if (body.channel !== "email") {
			let valid = false;
			try {
				valid = ["http:", "https:"].includes(new URL(String(body.destination ?? "")).protocol);
			} catch {
				valid = false;
			}
			if (!valid) {
				set.status = 400;
				return fail("destination must be an http(s) URL for this channel");
			}
		}
		return created(
			await createAlert({
				projectId: params.id,
				type: body.type,
				threshold: body.threshold,
				durationSeconds: body.durationSeconds,
				channel: body.channel,
				destination: body.destination,
			}),
		);
	})
	.patch("/alerts/:id", async ({ params: { id }, body, set }: any) => {
		if (body?.enabled === undefined) {
			set.status = 400;
			return fail("enabled is required");
		}
		const alert = await updateAlertEnabled(id, body.enabled);
		if (!alert) {
			set.status = 404;
			return fail("Alert not found");
		}
		return ok(alert);
	})
	.delete("/alerts/:id", async ({ params: { id }, set }) => {
		const deleted = await deleteAlert(id);
		if (!deleted) {
			set.status = 404;
			return fail("Alert not found");
		}
		return ok(null, "Alert deleted");
	});
